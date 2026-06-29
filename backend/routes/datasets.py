import os
import shutil
from datetime import datetime
from typing import List
import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from database import get_db
from models.models import Dataset, User
from routes.auth import get_current_user
from utils.schemas import DatasetResponse

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=DatasetResponse)
def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    # Check extension
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only CSV and Excel (.xlsx, .xls) are supported."
        )

    # Check if dataset already exists in the datahub for this user
    existing = db.query(Dataset).filter(
        Dataset.user_id == current_user.id,
        Dataset.file_name == filename
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset already exists in Datasets Hub."
        )

    # Save dataset metadata to DB
    new_dataset = Dataset(
        user_id=current_user.id,
        file_name=filename,
        status="Uploaded"
    )
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)

    # Save physical file to disk
    file_path = os.path.join(UPLOAD_DIR, f"dataset_{new_dataset.id}{ext}")
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        db.delete(new_dataset)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    return new_dataset

@router.get("", response_model=List[DatasetResponse])
def list_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Dataset).filter(Dataset.user_id == current_user.id).all()

@router.get("/{id}", response_model=DatasetResponse)
def get_dataset(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
    return dataset

@router.delete("/{id}")
def delete_dataset(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    # Remove physical file if exists
    for ext in [".csv", ".xlsx", ".xls"]:
        file_path = os.path.join(UPLOAD_DIR, f"dataset_{id}{ext}")
        if os.path.exists(file_path):
            os.remove(file_path)

    # Also check if a dynamic table was created for cleaned data and drop it
    try:
        from sqlalchemy import text
        db.execute(text(f"DROP TABLE IF EXISTS cleaned_data_{id}"))
        db.commit()
    except Exception:
        pass

    db.delete(dataset)
    db.commit()
    return {"message": "Dataset deleted successfully"}

@router.get("/{id}/profile")
def profile_dataset(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    # Load dataset
    file_path = None
    for ext in [".csv", ".xlsx", ".xls"]:
        path = os.path.join(UPLOAD_DIR, f"dataset_{id}{ext}")
        if os.path.exists(path):
            file_path = path
            break

    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical dataset file not found on disk"
        )

    try:
        # Load using pandas
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse dataset file: {str(e)}"
        )

    # Compute profiling metrics
    num_rows = len(df)
    num_cols = len(df.columns)
    duplicate_count = int(df.duplicated().sum())
    missing_by_col = df.isnull().sum().to_dict()

    columns_info = []
    for col in df.columns:
        col_series = df[col]
        
        # Inferred type
        dtype = str(col_series.dtype)
        if "int" in dtype or "float" in dtype:
            col_type = "numeric"
        elif "datetime" in dtype:
            col_type = "datetime"
        elif dtype == "bool":
            col_type = "boolean"
        else:
            # Check if strings are parseable as date
            try:
                pd.to_datetime(col_series.dropna().head(10), errors="raise")
                col_type = "datetime"
            except (ValueError, TypeError):
                col_type = "categorical"

        missing_count = int(missing_by_col[col])
        missing_percentage = float((missing_count / num_rows) * 100) if num_rows > 0 else 0.0
        unique_count = int(col_series.nunique())

        stats = {
            "missing_count": missing_count,
            "missing_percentage": missing_percentage,
            "unique_count": unique_count,
        }

        # Calculate specific summary stats
        if col_type == "numeric":
            cleaned_series = col_series.dropna()
            if len(cleaned_series) > 0:
                stats.update({
                    "mean": float(cleaned_series.mean()),
                    "min": float(cleaned_series.min()),
                    "max": float(cleaned_series.max()),
                    "std": float(cleaned_series.std()) if len(cleaned_series) > 1 else 0.0,
                    "median": float(cleaned_series.median()),
                })
        else:
            # Categorical value counts
            top_vals = col_series.value_counts().head(5).to_dict()
            stats["top_values"] = [{"value": str(k), "count": int(v)} for k, v in top_vals.items()]

        # Preview of first 5 values
        sample_values = col_series.head(5).fillna("").astype(str).tolist()

        columns_info.append({
            "name": col,
            "type": col_type,
            "stats": stats,
            "sample_values": sample_values
        })

    # Return profile dictionary
    profile_data = {
        "dataset_id": id,
        "file_name": dataset.file_name,
        "rows": num_rows,
        "columns_count": num_cols,
        "duplicate_count": duplicate_count,
        "columns": columns_info,
        "sample_data": df.head(10).fillna("").to_dict(orient="records")
    }

    return profile_data
