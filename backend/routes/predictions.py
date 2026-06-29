import os
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, f1_score, silhouette_score
from database import get_db
from models.models import Dataset, Prediction, User
from routes.auth import get_current_user
from utils.schemas import PredictionRequest
from services.warehouse_service import get_from_warehouse

router = APIRouter(prefix="/api/datasets", tags=["Predictive Analytics"])

@router.get("/{id}/predictions/options")
def get_prediction_options(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset.status != "Cleaned":
        raise HTTPException(status_code=400, detail="Dataset is not cleaned yet. Please clean it first.")

    try:
        df = get_from_warehouse(id, limit=1000)
        if "id" in df.columns:
            df = df.drop(columns=["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read from warehouse: {str(e)}")

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = []
    
    for col in df.select_dtypes(exclude=[np.number]).columns:
        # Suggest categorical targets if low cardinality
        cardinality = df[col].nunique()
        if cardinality <= 20:
            categorical_cols.append(col)

    return {
        "dataset_id": id,
        "numerical_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "all_columns": df.columns.tolist()
    }

@router.post("/{id}/predictions/run")
def run_prediction_model(
    id: int,
    req: PredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset.status != "Cleaned":
        raise HTTPException(status_code=400, detail="Dataset is not cleaned yet.")

    try:
        # Load larger chunk for ML
        df = get_from_warehouse(id, limit=20000)
        if "id" in df.columns:
            df = df.drop(columns=["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read data: {str(e)}")

    if len(df) < 20:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset has only {len(df)} rows. Need at least 20 rows to train models."
        )

    target = req.target_column
    features = req.feature_columns
    model_type = req.model_type
    algo = req.algorithm

    # Validate target and features
    if target not in df.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target}' not found in dataset.")
    for f in features:
        if f not in df.columns:
            raise HTTPException(status_code=400, detail=f"Feature column '{f}' not found in dataset.")

    # Drop null rows in target or features
    ml_df = df[[target] + features].dropna()
    if len(ml_df) < 15:
        raise HTTPException(status_code=400, detail="Too many missing values in selected columns. ML cannot run.")

    y = ml_df[target]
    X = ml_df[features]

    # Preprocessing
    # 1. Categorical Features Encoding
    cat_feats = X.select_dtypes(exclude=[np.number]).columns.tolist()
    if cat_feats:
        X = pd.get_dummies(X, columns=cat_feats, drop_first=True)

    # 2. Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X.fillna(0))

    # Preprocess Target
    is_classification = (model_type == "classification")
    is_clustering = (model_type == "clustering")
    
    y_encoded = y
    label_encoder = None
    if is_classification and not pd.api.types.is_numeric_dtype(y):
        label_encoder = LabelEncoder()
        y_encoded = label_encoder.fit_transform(y.astype(str))

    # Splitting (except for Clustering)
    if not is_clustering:
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_encoded, test_size=0.2, random_state=42)

    metrics = {}
    chart_data = []
    feature_importances = {}

    try:
        if model_type == "regression":
            if algo == "linear_regression":
                model = LinearRegression()
            else: # default to random_forest
                model = RandomForestRegressor(n_estimators=50, random_state=42)
            
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            
            mse = mean_squared_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            metrics = {
                "r2_score": float(r2),
                "mean_squared_error": float(mse),
                "rmse": float(np.sqrt(mse))
            }
            
            # Save predictions for charts (limit to first 100 test items)
            chart_limit = min(len(y_test), 100)
            for idx in range(chart_limit):
                chart_data.append({
                    "actual": float(y_test.iloc[idx] if hasattr(y_test, "iloc") else y_test[idx]),
                    "predicted": float(y_pred[idx])
                })

            # Feature importances
            if hasattr(model, "feature_importances_"):
                importances = model.feature_importances_
                for idx, col in enumerate(X.columns):
                    feature_importances[col] = float(importances[idx])
            elif hasattr(model, "coef_"):
                # Use absolute coefficient value as importance
                for idx, col in enumerate(X.columns):
                    feature_importances[col] = float(abs(model.coef_[idx]))

            accuracy_val = Decimal(str(max(0.0, r2 * 100))) # accuracy maps to R2 score in database log

        elif model_type == "classification":
            if algo == "logistic_regression":
                model = LogisticRegression(max_iter=1000, random_state=42)
            else: # default to random forest
                model = RandomForestClassifier(n_estimators=50, random_state=42)

            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)

            acc = accuracy_score(y_test, y_pred)
            f1 = f1_score(y_test, y_pred, average="macro")
            metrics = {
                "accuracy": float(acc),
                "f1_score": float(f1)
            }

            # Map back to string labels if encoded
            chart_limit = min(len(y_test), 100)
            for idx in range(chart_limit):
                act_val = y_test.iloc[idx] if hasattr(y_test, "iloc") else y_test[idx]
                pred_val = y_pred[idx]
                if label_encoder:
                    act_val = str(label_encoder.inverse_transform([int(act_val)])[0])
                    pred_val = str(label_encoder.inverse_transform([int(pred_val)])[0])
                chart_data.append({
                    "actual": str(act_val),
                    "predicted": str(pred_val)
                })

            if hasattr(model, "feature_importances_"):
                importances = model.feature_importances_
                for idx, col in enumerate(X.columns):
                    feature_importances[col] = float(importances[idx])

            accuracy_val = Decimal(str(acc * 100))

        elif model_type == "clustering":
            # Select K-Means
            k_clusters = 3
            model = KMeans(n_clusters=k_clusters, random_state=42)
            clusters = model.fit_predict(X_scaled)
            
            sil = silhouette_score(X_scaled, clusters) if len(np.unique(clusters)) > 1 else 0.0
            metrics = {
                "silhouette_score": float(sil),
                "num_clusters": k_clusters
            }
            
            # Put clustering results on first 100 values
            chart_limit = min(len(X_scaled), 100)
            # Find two columns with high variance for visualization
            vars = X.var()
            top_cols = vars.nlargest(2).index.tolist()
            col1_idx = X.columns.get_loc(top_cols[0]) if len(top_cols) > 0 else 0
            col2_idx = X.columns.get_loc(top_cols[1]) if len(top_cols) > 1 else 0
            
            for idx in range(chart_limit):
                chart_data.append({
                    "x": float(X_scaled[idx][col1_idx]),
                    "y": float(X_scaled[idx][col2_idx]),
                    "cluster": int(clusters[idx])
                })
            
            accuracy_val = Decimal(str(max(0.0, sil * 100)))

        else:
            raise HTTPException(status_code=400, detail="Invalid model type.")

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Model training or evaluation failed: {str(e)}"
        )

    # Save to Database predictions logs
    db_pred = Prediction(
        dataset_id=id,
        model_name=algo,
        accuracy=accuracy_val
    )
    db.add(db_pred)
    db.commit()

    return {
        "dataset_id": id,
        "model_name": algo,
        "metrics": metrics,
        "feature_importances": feature_importances,
        "predictions_preview": chart_data
    }
