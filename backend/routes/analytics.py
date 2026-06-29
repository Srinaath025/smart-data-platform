import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
from database import get_db
from models.models import Dataset, User
from routes.auth import get_current_user
from services.warehouse_service import get_from_warehouse

router = APIRouter(prefix="/api/datasets", tags=["Analytics & BI"])

@router.get("/{id}/analytics/summary")
def get_analytics_summary(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset.status != "Cleaned":
        raise HTTPException(status_code=400, detail="Please clean the dataset first to generate analytics.")

    try:
        df = get_from_warehouse(id, limit=50000) # Load up to 50k rows for analytics
        if "id" in df.columns:
            df = df.drop(columns=["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read from warehouse: {str(e)}")

    # 1. Basic Stats
    rows_count = len(df)
    cols_count = len(df.columns)
    
    numeric_df = df.select_dtypes(include=[np.number])
    categorical_df = df.select_dtypes(exclude=[np.number])

    # 2. Numeric descriptive stats
    num_stats = {}
    for col in numeric_df.columns:
        desc = numeric_df[col].describe().replace({np.nan: None}).to_dict()
        num_stats[col] = desc

    # 3. Categorical distribution summaries
    cat_distributions = {}
    for col in categorical_df.columns:
        val_counts = categorical_df[col].value_counts().head(10).to_dict()
        cat_distributions[col] = [{"value": str(k), "count": int(v)} for k, v in val_counts.items()]

    # 4. Correlation matrix (numeric only)
    correlation_matrix = {}
    if len(numeric_df.columns) > 1:
        corr_df = numeric_df.corr().replace({np.nan: None})
        correlation_matrix = corr_df.to_dict()

    # 5. Histogram data for numeric columns
    histograms = {}
    for col in numeric_df.columns:
        series = numeric_df[col].dropna()
        if len(series) > 0:
            counts, bin_edges = np.histogram(series, bins=10)
            histograms[col] = {
                "counts": counts.tolist(),
                "bins": [float(b) for b in bin_edges]
            }

    return {
        "dataset_id": id,
        "file_name": dataset.file_name,
        "rows": rows_count,
        "cols": cols_count,
        "numeric_stats": num_stats,
        "categorical_distributions": cat_distributions,
        "correlation_matrix": correlation_matrix,
        "histograms": histograms
    }

@router.get("/{id}/analytics/insights")
def get_ai_insights(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset.status != "Cleaned":
        raise HTTPException(status_code=400, detail="Please clean the dataset first to generate insights.")

    try:
        df = get_from_warehouse(id, limit=50000)
        if "id" in df.columns:
            df = df.drop(columns=["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read from warehouse: {str(e)}")

    insights = []
    recommendations = []

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()

    # Insight 1: General Size & Diversity
    insights.append({
        "type": "summary",
        "title": "Dataset Profile Summary",
        "content": f"The dataset contains {len(df)} rows and {len(df.columns)} columns. There are {len(numeric_cols)} numerical features and {len(categorical_cols)} categorical/string features."
    })

    # Insight 2: High Correlations
    if len(numeric_cols) > 1:
        corr_matrix = df[numeric_cols].corr()
        checked_pairs = set()
        strong_correlations = []
        for i in range(len(numeric_cols)):
            for j in range(len(numeric_cols)):
                if i != j:
                    pair = tuple(sorted([numeric_cols[i], numeric_cols[j]]))
                    if pair not in checked_pairs:
                        checked_pairs.add(pair)
                        r_val = corr_matrix.iloc[i, j]
                        if abs(r_val) >= 0.6 and not np.isnan(r_val):
                            strong_correlations.append((pair[0], pair[1], r_val))
        
        if strong_correlations:
            # Sort by absolute correlation
            strong_correlations.sort(key=lambda x: abs(x[2]), reverse=True)
            top_corr = strong_correlations[0]
            corr_type = "positive" if top_corr[2] > 0 else "negative"
            insights.append({
                "type": "correlation",
                "title": f"Strong Correlation Detected",
                "content": f"We detected a strong {corr_type} correlation ({top_corr[2]:.2f}) between '{top_corr[0]}' and '{top_corr[1]}'. When '{top_corr[0]}' changes, '{top_corr[1]}' tends to change proportionally. Consider linking them or pruning one if training highly correlated features."
            })
            recommendations.append(f"In modeling, avoid multi-collinearity by selecting either '{top_corr[0]}' or '{top_corr[1]}' rather than both.")

    # Insight 3: Categorical Concentrations
    for col in categorical_cols:
        col_series = df[col].dropna()
        if len(col_series) > 0:
            top_val = col_series.value_counts().head(1)
            if not top_val.empty:
                val = top_val.index[0]
                pct = (top_val.values[0] / len(col_series)) * 100
                if pct > 60:
                    insights.append({
                        "type": "concentration",
                        "title": f"Dominant Class in '{col}'",
                        "content": f"The category '{val}' represents {pct:.1f}% of all values in the column '{col}'. This indicates high concentration and may represent class imbalance if '{col}' is used as a model target."
                    })
                    recommendations.append(f"If training classification models with target '{col}', use resampling or class weighting to handle imbalance.")
                    break # just show one dominant column to prevent spam

    # Insight 4: Variance / Distribution Skewness
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) >= 10:
            skew = series.skew()
            if abs(skew) > 1.5 and not np.isnan(skew):
                skew_type = "right-skewed (positive skew)" if skew > 0 else "left-skewed (negative skew)"
                insights.append({
                    "type": "distribution",
                    "title": f"Highly Skewed Column: '{col}'",
                    "content": f"The column '{col}' is highly {skew_type} with a skewness coefficient of {skew:.2f}. Extreme values or outliers might be shifting the average."
                })
                recommendations.append(f"For machine learning models, consider applying a log transform or power transform to '{col}' to make its distribution more normal.")
                break

    # Insight 5: Unique ID features
    for col in df.columns:
        unique_pct = (df[col].nunique() / len(df)) * 100
        if unique_pct > 95 and df[col].dtype == "object":
            insights.append({
                "type": "cardinality",
                "title": f"High Cardinality Feature: '{col}'",
                "content": f"Column '{col}' contains {df[col].nunique()} unique string values ({unique_pct:.1f}% unique). This resembles an Identifier/ID column."
            })
            recommendations.append(f"Exclude the identifier column '{col}' from machine learning models to prevent overfitting.")
            break

    # Fallback recommendations if none added
    if not recommendations:
        recommendations.append("Ensure your data columns are appropriately scaled before applying regression algorithms.")
        recommendations.append("Check feature importances during modeling to select the most relevant attributes.")

    return {
        "dataset_id": id,
        "insights": insights,
        "recommendations": recommendations
    }
