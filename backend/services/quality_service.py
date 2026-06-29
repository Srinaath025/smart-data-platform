import re
import pandas as pd
import numpy as np
from typing import Dict, Any

def calculate_quality_score(df: pd.DataFrame) -> Dict[str, Any]:
    num_rows = len(df)
    num_cols = len(df.columns)
    
    if num_rows == 0 or num_cols == 0:
        return {
            "overall_score": 100.0,
            "completeness": 100.0,
            "uniqueness": 100.0,
            "consistency": 100.0,
            "validity": 100.0,
            "accuracy": 100.0
        }

    # 1. Completeness
    total_cells = num_rows * num_cols
    null_cells = df.isnull().sum().sum()
    completeness = float(((total_cells - null_cells) / total_cells) * 100)

    # 2. Uniqueness
    duplicate_rows = df.duplicated().sum()
    uniqueness = float(((num_rows - duplicate_rows) / num_rows) * 100)

    # 3. Consistency (Type uniformity within columns)
    consistency_scores = []
    for col in df.columns:
        non_null_col = df[col].dropna()
        if len(non_null_col) == 0:
            consistency_scores.append(100.0)
            continue
        
        # Get types of all elements in the column
        type_counts = non_null_col.apply(lambda x: type(x).__name__).value_counts()
        majority_type_count = type_counts.max()
        col_consistency = (majority_type_count / len(non_null_col)) * 100
        consistency_scores.append(col_consistency)
    
    consistency = float(np.mean(consistency_scores)) if consistency_scores else 100.0

    # 4. Validity (Pattern checking for common fields: email, numeric range)
    validity_scores = []
    
    email_regex = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    
    for col in df.columns:
        col_lower = str(col).lower()
        non_null_col = df[col].dropna().astype(str)
        if len(non_null_col) == 0:
            continue

        if "email" in col_lower:
            valid_emails = non_null_col.apply(lambda x: 1 if email_regex.match(x.strip()) else 0).sum()
            validity_scores.append((valid_emails / len(non_null_col)) * 100)
            
        elif any(k in col_lower for k in ["price", "cost", "salary", "amount", "revenue"]):
            # Check non-negative numeric
            numeric_vals = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(numeric_vals) > 0:
                valid_numeric = (numeric_vals >= 0).sum()
                validity_scores.append((valid_numeric / len(numeric_vals)) * 100)
    
    validity = float(np.mean(validity_scores)) if validity_scores else 100.0

    # 5. Accuracy (Outlier-based score)
    outlier_counts = 0
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        col_series = df[col].dropna()
        if len(col_series) >= 5:
            q1 = col_series.quantile(0.25)
            q3 = col_series.quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outlier_counts += ((df[col] < lower_bound) | (df[col] > upper_bound)).sum()
            
    total_numeric_cells = len(df) * len(numeric_cols)
    if total_numeric_cells > 0:
        accuracy = float(((total_numeric_cells - outlier_counts) / total_numeric_cells) * 100)
        accuracy = max(0.0, accuracy) # Keep positive
    else:
        accuracy = 100.0

    # 6. Overall Quality Score (Weighted average)
    overall_score = (
        completeness * 0.30 +
        uniqueness * 0.20 +
        consistency * 0.20 +
        validity * 0.15 +
        accuracy * 0.15
    )

    return {
        "overall_score": round(overall_score, 2),
        "completeness": round(completeness, 2),
        "uniqueness": round(uniqueness, 2),
        "consistency": round(consistency, 2),
        "validity": round(validity, 2),
        "accuracy": round(accuracy, 2)
    }
