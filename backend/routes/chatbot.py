import re
import os
import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models.models import Dataset, User
from routes.auth import get_current_user
from utils.schemas import ChatRequest

router = APIRouter(prefix="/api/datasets", tags=["Chatbot"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

@router.post("/{id}/chat")
def query_chatbot(
    id: int,
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    if dataset.status != "Cleaned":
        raise HTTPException(status_code=400, detail="Dataset is not cleaned yet. Please clean it first to enable chat.")

    user_query = req.message.strip().lower()

    # 1. Check general knowledge questions
    general_qa_responses = {
        r"\b(machine learning|ml)\b": (
            "Machine Learning (ML) is a branch of artificial intelligence where algorithms "
            "learn patterns from data to make predictions or decisions. "
            "Our platform supports Regression, Classification, and K-Means Clustering in the Predictions tab."
        ),
        r"\b(linear regression|regression)\b": (
            "Linear Regression modeling finds a linear relationship between input features "
            "and a continuous target variable. It computes coefficients to fit a best-fit straight line."
        ),
        r"\b(k-means|clustering|kmeans)\b": (
            "K-Means Clustering is an unsupervised algorithm that groups similar records into K distinct clusters. "
            "It computes centroids for each cluster and assigns each data point to its closest centroid."
        ),
        r"\b(standard deviation|std dev|stddev)\b": (
            "Standard Deviation measures the dispersion or spread of a dataset relative to its mean. "
            "A low standard deviation means points are close to the mean, while a high standard deviation indicates wider spread."
        ),
        r"\b(mean|average)\b.*\b(what is|explain)\b": (
            "The mean (or average) is the sum of all values divided by the total count. It represents the central value of a dataset."
        ),
        r"\b(data cleaning|cleaning|clean)\b": (
            "Data cleaning fixes or removes incorrect, duplicate, corrupted, incorrectly formatted, "
            "or incomplete data within a dataset. We offer missing value imputation, text normalization, and outlier removal."
        ),
        r"\b(correlation|pearson)\b": (
            "Correlation measures the linear relationship between two variables, ranging from -1 to +1. "
            "A value close to +1 indicates a strong positive relationship, -1 indicates strong negative, and 0 indicates no relation."
        ),
        r"\b(outlier|outliers)\b": (
            "Outliers are data points that differ significantly from other observations. They can be identified using "
            "Z-Score (standard deviations from mean) or IQR (distance outside the interquartile range)."
        )
    }

    for pattern, answer in general_qa_responses.items():
        if re.search(pattern, user_query):
            return {
                "response": answer,
                "data": [],
                "sql": "",
                "chart_type": None
            }

    # 2. Find file path
    file_path = None
    for ext in [".csv", ".xlsx", ".xls"]:
        path = os.path.join(UPLOAD_DIR, f"dataset_{id}{ext}")
        if os.path.exists(path):
            file_path = path
            break

    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical dataset file not found on disk."
        )

    # 3. Read dataset in memory using Pandas to calculate statistics
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

    # 4. Check dataset statistics queries
    columns_lower = [c.lower() for c in df.columns]
    matched_cols = [c for c in df.columns if c.lower() in user_query]

    # Intent A: Row Count / Column Count
    if any(k in user_query for k in ["how many rows", "total count", "number of records", "how many records", "size of dataset", "total rows"]):
        return {
            "response": f"The dataset contains a total of **{len(df):,}** records (rows) and **{len(df.columns)}** features (columns).",
            "data": [],
            "sql": "",
            "chart_type": None
        }

    # Intent B: Missing / Null values
    if any(k in user_query for k in ["missing", "null", "empty", "nan", "missing cells"]):
        missing = df.isnull().sum().to_dict()
        total_missing = sum(missing.values())
        if total_missing == 0:
            return {
                "response": "Great news! There are no missing values (nulls) detected in this dataset.",
                "data": [],
                "sql": "",
                "chart_type": None
            }
        else:
            details = ", ".join([f"`{c}` ({v} missing)" for c, v in missing.items() if v > 0])
            return {
                "response": f"There are **{total_missing:,}** total missing cells in the dataset. Column details:\n\n{details}",
                "data": [],
                "sql": "",
                "chart_type": None
            }

    # Intent C: Statistical Averages
    if any(k in user_query for k in ["average", "mean", "avg"]):
        if matched_cols:
            answers = []
            for col in matched_cols:
                if pd.api.types.is_numeric_dtype(df[col]):
                    val = df[col].mean()
                    answers.append(f"The average (mean) of `{col}` is **{val:,.2f}**.")
                else:
                    answers.append(f"`{col}` is a text/categorical column, so it does not have a numeric average.")
            return {
                "response": "\n".join(answers),
                "data": [],
                "sql": "",
                "chart_type": None
            }
        else:
            return {
                "response": "Please specify one or more numeric columns to find the average (e.g. *what is the average age?*).",
                "data": [],
                "sql": "",
                "chart_type": None
            }

    # Intent D: Sums / Totals
    if any(k in user_query for k in ["sum", "total", "add up", "total sum"]):
        if matched_cols:
            answers = []
            for col in matched_cols:
                if pd.api.types.is_numeric_dtype(df[col]):
                    val = df[col].sum()
                    answers.append(f"The total sum of `{col}` is **{val:,.2f}**.")
                else:
                    answers.append(f"`{col}` is a text column and cannot be summed.")
            return {
                "response": "\n".join(answers),
                "data": [],
                "sql": "",
                "chart_type": None
            }
        else:
            return {
                "response": "Please specify a numeric column to sum (e.g. *what is the total of sales?*).",
                "data": [],
                "sql": "",
                "chart_type": None
            }

    # Intent E: Standard Deviation
    if any(k in user_query for k in ["standard deviation", "std dev", "stddev", "spread"]):
        if matched_cols:
            answers = []
            for col in matched_cols:
                if pd.api.types.is_numeric_dtype(df[col]):
                    val = df[col].std()
                    answers.append(f"The standard deviation of `{col}` is **{val:,.2f}** (indicating the spread around the mean).")
            return {
                "response": "\n".join(answers),
                "data": [],
                "sql": "",
                "chart_type": None
            }

    # Intent F: Descriptive Summary
    if any(k in user_query for k in ["describe", "statistics", "summary", "stats"]):
        if matched_cols:
            col = matched_cols[0]
            if pd.api.types.is_numeric_dtype(df[col]):
                desc = df[col].describe().to_dict()
                return {
                    "response": (
                        f"### Statistical summary for `{col}`:\n"
                        f"- **Count:** {desc.get('count', 0):,.0f}\n"
                        f"- **Mean (Average):** {desc.get('mean', 0):,.2f}\n"
                        f"- **Standard Deviation:** {desc.get('std', 0):,.2f}\n"
                        f"- **Minimum:** {desc.get('min', 0):,.2f}\n"
                        f"- **25% (First Quartile):** {desc.get('25%', 0):,.2f}\n"
                        f"- **Median (50%):** {desc.get('50%', 0):,.2f}\n"
                        f"- **75% (Third Quartile):** {desc.get('75%', 0):,.2f}\n"
                        f"- **Maximum:** {desc.get('max', 0):,.2f}"
                    ),
                    "data": [],
                    "sql": "",
                    "chart_type": None
                }

    # Fallback message listing options
    cols_display = ", ".join(df.columns[:8])
    if len(df.columns) > 8:
        cols_display += ", and more"

    return {
        "response": (
            "I am programmed to explain statistics, averages, and data concepts. "
            f"Here are the columns in your dataset: **{cols_display}**.\n\n"
            "You can ask me questions such as:\n"
            "- *What is the average of age?*\n"
            "- *Show total count of rows*\n"
            "- *Describe column income*\n"
            "- *Explain what is standard deviation*"
        ),
        "data": [],
        "sql": "",
        "chart_type": None
    }
