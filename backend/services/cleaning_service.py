import re
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple

def clean_dataset(df: pd.DataFrame, config: Dict[str, Any]) -> Tuple[pd.DataFrame, Dict[str, int]]:
    # Work on a copy of the dataframe
    cleaned_df = df.copy()
    logs = {
        "missing_values_removed": 0,
        "duplicates_removed": 0,
        "outliers_detected": 0
    }

    # 1. Duplicate Removal
    if config.get("remove_duplicates", True):
        initial_rows = len(cleaned_df)
        cleaned_df = cleaned_df.drop_duplicates()
        logs["duplicates_removed"] = initial_rows - len(cleaned_df)

    # 2. Text Cleaning & Standardizing Strings
    text_trim = config.get("text_trim", True)
    text_case = config.get("text_case", "none") # upper, lower, title, none
    remove_special = config.get("remove_special_chars", False)

    for col in cleaned_df.columns:
        if cleaned_df[col].dtype == "object":
            # Strip whitespace
            if text_trim:
                cleaned_df[col] = cleaned_df[col].astype(str).str.strip()
            
            # Apply casing
            if text_case == "upper":
                cleaned_df[col] = cleaned_df[col].astype(str).str.upper()
            elif text_case == "lower":
                cleaned_df[col] = cleaned_df[col].astype(str).str.lower()
            elif text_case == "title":
                cleaned_df[col] = cleaned_df[col].astype(str).str.title()
                
            # Remove special characters
            if remove_special:
                cleaned_df[col] = cleaned_df[col].astype(str).apply(
                    lambda x: re.sub(r"[^a-zA-Z0-9\s\.\,\-\_\@\:\/\+]", "", x)
                )

    # 3. Date Standardization
    if config.get("date_standardization", True):
        for col in cleaned_df.columns:
            # Check if this column name or sample data looks like date
            col_lower = col.lower()
            is_date_col = "date" in col_lower or "time" in col_lower
            
            sample = cleaned_df[col].dropna().head(5).astype(str).tolist()
            is_date_format = False
            for s in sample:
                # regex check for date patterns (e.g. 2023-01-01, 12/31/2022, etc.)
                if re.search(r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}", s):
                    is_date_format = True
                    break
            
            if is_date_col or is_date_format:
                try:
                    cleaned_df[col] = pd.to_datetime(cleaned_df[col], errors="ignore")
                    # If conversion was successful (dtype is datetime), format to string YYYY-MM-DD
                    if pd.api.types.is_datetime64_any_dtype(cleaned_df[col]):
                        cleaned_df[col] = cleaned_df[col].dt.strftime("%Y-%m-%d")
                except Exception:
                    pass

    # 4. Column Headers Standardization
    if config.get("column_standardization", True):
        new_cols = []
        for col in cleaned_df.columns:
            # convert to lowercase, replace non-alphanumeric with underscores, strip extra underscores
            s = str(col).strip().lower()
            s = re.sub(r"[^a-z0-9]", "_", s)
            s = re.sub(r"_+", "_", s)
            s = s.strip("_")
            if not s:
                s = f"column_{len(new_cols)}"
            # Handle duplicate column names
            if s in new_cols:
                base = s
                counter = 1
                while f"{base}_{counter}" in new_cols:
                    counter += 1
                s = f"{base}_{counter}"
            new_cols.append(s)
        cleaned_df.columns = new_cols

    # 5. Outlier Detection & Action
    outlier_method = config.get("outlier_method", "iqr") # iqr, zscore, none
    outlier_action = config.get("outlier_action", "highlight") # highlight, remove, replace

    if outlier_method in ["iqr", "zscore"]:
        numeric_cols = cleaned_df.select_dtypes(include=[np.number]).columns
        outlier_mask = pd.DataFrame(False, index=cleaned_df.index, columns=numeric_cols)

        for col in numeric_cols:
            col_series = cleaned_df[col].dropna()
            if len(col_series) < 5:
                continue

            if outlier_method == "iqr":
                q1 = col_series.quantile(0.25)
                q3 = col_series.quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                col_outliers = (cleaned_df[col] < lower_bound) | (cleaned_df[col] > upper_bound)
            else: # zscore
                mean = col_series.mean()
                std = col_series.std()
                if std > 0:
                    z_scores = (cleaned_df[col] - mean) / std
                    col_outliers = z_scores.abs() > 3
                else:
                    col_outliers = pd.Series(False, index=cleaned_df.index)

            outlier_mask[col] = col_outliers
            logs["outliers_detected"] += int(col_outliers.sum())

        if logs["outliers_detected"] > 0:
            if outlier_action == "remove":
                # Remove rows that have any numeric outlier
                rows_before = len(cleaned_df)
                cleaned_df = cleaned_df[~outlier_mask.any(axis=1)]
                # Update duplicates and check rows
            elif outlier_action == "replace":
                # Replace outliers with column median
                for col in numeric_cols:
                    col_median = cleaned_df[col].median()
                    cleaned_df.loc[outlier_mask[col], col] = col_median

    # 6. Missing Values Handling
    missing_method = config.get("missing_values_method", "mean") # mean, median, mode, constant, ffill, bfill, none
    constant_val = config.get("missing_values_constant", "")

    if missing_method != "none":
        for col in cleaned_df.columns:
            null_count = int(cleaned_df[col].isnull().sum())
            if null_count > 0:
                logs["missing_values_removed"] += null_count
                
                # Fill missing
                if missing_method == "mean" and pd.api.types.is_numeric_dtype(cleaned_df[col]):
                    cleaned_df[col] = cleaned_df[col].fillna(cleaned_df[col].mean())
                elif missing_method == "median" and pd.api.types.is_numeric_dtype(cleaned_df[col]):
                    cleaned_df[col] = cleaned_df[col].fillna(cleaned_df[col].median())
                elif missing_method == "mode":
                    mode_val = cleaned_df[col].mode()
                    if not mode_val.empty:
                        cleaned_df[col] = cleaned_df[col].fillna(mode_val[0])
                elif missing_method == "constant":
                    # Parse constant value type if column is numeric
                    val = constant_val
                    if pd.api.types.is_numeric_dtype(cleaned_df[col]):
                        try:
                            val = float(constant_val) if "." in constant_val else int(constant_val)
                        except ValueError:
                            pass
                    cleaned_df[col] = cleaned_df[col].fillna(val)
                elif missing_method == "ffill":
                    cleaned_df[col] = cleaned_df[col].ffill().bfill() # bfill handles leading nulls
                elif missing_method == "bfill":
                    cleaned_df[col] = cleaned_df[col].bfill().ffill()
                else:
                    # Fallback for non-numeric columns when mean/median is selected
                    mode_val = cleaned_df[col].mode()
                    if not mode_val.empty:
                        cleaned_df[col] = cleaned_df[col].fillna(mode_val[0])
                    else:
                        cleaned_df[col] = cleaned_df[col].fillna("")

    # Replace NaNs with None for DB/JSON compatibility
    # Keep numeric types but replace object NaNs
    cleaned_df = cleaned_df.replace({np.nan: None})

    return cleaned_df, logs
