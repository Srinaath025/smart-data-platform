from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

# Auth Schemas
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=4)
    role: Optional[str] = "Analyst"

    @field_validator("email")
    @classmethod
    def validate_email_tld(cls, v: str) -> str:
        email_str = v.strip().lower()
        parts = email_str.split("@")
        if len(parts) == 2:
            domain = parts[1]
            domain_parts = domain.split(".")
            if len(domain_parts) >= 2:
                tld = domain_parts[-1]
                if len(tld) < 2:
                    raise ValueError("Email domain top-level extension must be at least 2 characters long (e.g. .in, .com)")
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_tld(cls, v: str) -> str:
        email_str = v.strip().lower()
        parts = email_str.split("@")
        if len(parts) == 2:
            domain = parts[1]
            domain_parts = domain.split(".")
            if len(domain_parts) >= 2:
                tld = domain_parts[-1]
                if len(tld) < 2:
                    raise ValueError("Email domain top-level extension must be at least 2 characters long (e.g. .in, .com)")
        return v

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Dataset Schemas
class DatasetResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    file_name: Optional[str] = None
    upload_date: Optional[datetime] = None
    status: Optional[str] = None

    class Config:
        from_attributes = True

# Cleaning Config
class CleaningConfig(BaseModel):
    missing_values_method: str = "mean" # mean, median, mode, constant, ffill, bfill, none
    missing_values_constant: Optional[str] = ""
    remove_duplicates: bool = True
    outlier_method: str = "iqr" # iqr, zscore, none
    outlier_action: str = "highlight" # highlight, remove, replace
    text_trim: bool = True
    text_case: str = "none" # upper, lower, title, none
    remove_special_chars: bool = False
    date_standardization: bool = True
    column_standardization: bool = True

# Prediction Configs
class PredictionRequest(BaseModel):
    target_column: str
    feature_columns: List[str]
    model_type: str  # regression, classification, clustering
    algorithm: str   # linear_regression, random_forest, logistic_regression, decision_tree, kmeans

class ChatRequest(BaseModel):
    message: str
