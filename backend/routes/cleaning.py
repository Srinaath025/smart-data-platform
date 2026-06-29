import os
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import pandas as pd
from database import get_db
from models.models import Dataset, CleaningLog, User
from routes.auth import get_current_user
from utils.schemas import CleaningConfig
from services.cleaning_service import clean_dataset
from services.quality_service import calculate_quality_score
from services.warehouse_service import save_to_warehouse

router = APIRouter(prefix="/api/datasets", tags=["Data Cleaning"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

@router.post("/{id}/clean")
def clean_dataset_endpoint(
    id: int,
    config: CleaningConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    # Find file path
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
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}"
        )

    # 1. Calculate Initial Quality Score
    initial_quality = calculate_quality_score(df)
    
    # 2. Run automated cleaning
    cleaned_df, logs = clean_dataset(df, config.model_dump())
    
    # 3. Calculate Cleaned Quality Score
    cleaned_quality = calculate_quality_score(cleaned_df)

    # 4. Save to warehouse (creates SQL table `cleaned_data_{id}`)
    try:
        save_to_warehouse(cleaned_df, id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save cleaned data to warehouse: {str(e)}"
        )

    # 5. Save logs to database
    db_log = CleaningLog(
        dataset_id=id,
        missing_values_removed=logs["missing_values_removed"],
        duplicates_removed=logs["duplicates_removed"],
        outliers_detected=logs["outliers_detected"],
        quality_score=Decimal(str(cleaned_quality["overall_score"]))
    )
    db.add(db_log)
    
    # Update dataset status
    dataset.status = "Cleaned"
    db.commit()
    db.refresh(db_log)

    return {
        "dataset_id": id,
        "status": "Success",
        "file_name": dataset.file_name,
        "metrics": {
            "initial_rows": len(df),
            "cleaned_rows": len(cleaned_df),
            "missing_values_removed": logs["missing_values_removed"],
            "duplicates_removed": logs["duplicates_removed"],
            "outliers_detected": logs["outliers_detected"],
        },
        "quality_scores": {
            "before": initial_quality,
            "after": cleaned_quality
        }
    }
