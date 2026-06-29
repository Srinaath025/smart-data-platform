from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=True)
    email = Column(String(100), unique=True, index=True, nullable=True)
    password = Column(String(255), nullable=True)
    role = Column(String(50), default="Analyst", nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=True)

    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan")

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    file_name = Column(String(255), nullable=True)
    upload_date = Column(DateTime, server_default=func.now(), nullable=True)
    status = Column(String(50), default="Uploaded", nullable=True)

    user = relationship("User", back_populates="datasets")
    cleaning_logs = relationship("CleaningLog", back_populates="dataset", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="dataset", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="dataset", cascade="all, delete-orphan")

class CleaningLog(Base):
    __tablename__ = "cleaning_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True)
    missing_values_removed = Column(Integer, default=0, nullable=True)
    duplicates_removed = Column(Integer, default=0, nullable=True)
    outliers_detected = Column(Integer, default=0, nullable=True)
    quality_score = Column(Numeric(5, 2), default=0.00, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=True)

    dataset = relationship("Dataset", back_populates="cleaning_logs")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True)
    report_name = Column(String(255), nullable=True)
    generated_at = Column(DateTime, server_default=func.now(), nullable=True)

    dataset = relationship("Dataset", back_populates="reports")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True)
    model_name = Column(String(100), nullable=True)
    accuracy = Column(Numeric(5, 2), default=0.00, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=True)

    dataset = relationship("Dataset", back_populates="predictions")

class DashboardConfig(Base):
    __tablename__ = "dashboard_configs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    config_json = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=True)
