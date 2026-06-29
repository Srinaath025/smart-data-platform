import os
import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from database import get_db
from models.models import Dataset, CleaningLog, User, Report
from routes.auth import get_current_user
from services.warehouse_service import get_from_warehouse

router = APIRouter(prefix="/api/datasets", tags=["Reporting"])

@router.get("/{id}/reports/logs")
def get_cleaning_logs(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    logs = db.query(CleaningLog).filter(CleaningLog.dataset_id == id).order_by(CleaningLog.created_at.desc()).all()
    return logs

@router.get("/{id}/export/{format}")
def export_dataset(
    id: int,
    format: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.status != "Cleaned":
        raise HTTPException(
            status_code=400,
            detail="Dataset is not cleaned yet. Please clean it before exporting."
        )

    try:
        # Load all rows from warehouse
        df = get_from_warehouse(id, limit=100000) # Fetch up to 100k rows
        # Drop the row_id column added during warehouse save if it exists
        if "id" in df.columns:
            df = df.drop(columns=["id"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load data from warehouse: {str(e)}")

    if format.lower() == "csv":
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        response = StreamingResponse(
            io.BytesIO(stream.getvalue().encode("utf-8")),
            media_type="text/csv"
        )
        response.headers["Content-Disposition"] = f"attachment; filename=cleaned_{dataset.file_name}"
        return response

    elif format.lower() == "xlsx":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Cleaned Data")
        output.seek(0)
        response = StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response.headers["Content-Disposition"] = f"attachment; filename=cleaned_{os.path.splitext(dataset.file_name)[0]}.xlsx"
        return response

    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported: csv, xlsx")

@router.get("/{id}/export/pdf")
def export_pdf_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dataset = db.query(Dataset).filter(Dataset.id == id, Dataset.user_id == current_user.id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    log = db.query(CleaningLog).filter(CleaningLog.dataset_id == id).order_by(CleaningLog.created_at.desc()).first()
    if not log:
        raise HTTPException(status_code=400, detail="No cleaning logs found. Please clean dataset first.")

    try:
        df = get_from_warehouse(id, limit=50)
        if "id" in df.columns:
            df = df.drop(columns=["id"])
    except Exception:
        df = pd.DataFrame()

    # Save PDF report details to Database reports table
    report_record = Report(
        dataset_id=id,
        report_name=f"Data_Quality_Report_{id}.pdf"
    )
    db.add(report_record)
    db.commit()

    # Build PDF
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buffer,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    story = []

    # Styling
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.HexColor('#6C5DD3'),
        spaceAfter=12
    )
    section_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=colors.HexColor('#2D3748'),
        spaceBefore=15,
        spaceAfter=8
    )
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#4A5568')
    )

    story.append(Paragraph("Smart Data Platform - Report", title_style))
    story.append(Paragraph(f"Dataset Name: <b>{dataset.file_name}</b>", body_style))
    story.append(Paragraph(f"Generated On: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", body_style))
    story.append(Paragraph(f"Owner: {current_user.name} ({current_user.email})", body_style))
    story.append(Spacer(1, 15))

    # 1. Summary of Cleaning
    story.append(Paragraph("1. Data Cleaning Session Summary", section_style))
    cleaning_summary_data = [
        ["Metric", "Value"],
        ["Cleaned Quality Score", f"{log.quality_score}%"],
        ["Missing Values Handled", str(log.missing_values_removed)],
        ["Duplicates Removed", str(log.duplicates_removed)],
        ["Outliers Detected", str(log.outliers_detected)],
    ]
    t1 = Table(cleaning_summary_data, colWidths=[200, 200])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#6C5DD3')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F7FAFC')),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
    ]))
    story.append(t1)
    story.append(Spacer(1, 15))

    # 2. Columns In Cleaned Dataset
    story.append(Paragraph("2. Dataset Schema (Cleaned)", section_style))
    cols_data = [["Column Name", "Data Type"]]
    for col in df.columns:
        dtype = str(df[col].dtype)
        cols_data.append([col, dtype])
    
    t2 = Table(cols_data, colWidths=[250, 150])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2D3748')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 5),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F7FAFC')]),
        ('FONTSIZE', (0,0), (-1,-1), 9),
    ]))
    story.append(t2)
    story.append(Spacer(1, 15))

    # 3. Sample Data Preview
    story.append(Paragraph("3. Cleaned Data Preview (Top 5 rows)", section_style))
    sample_cols = df.columns[:5].tolist() # limit columns in preview to fit page width
    sample_data = [sample_cols]
    
    for _, row in df.head(5).iterrows():
        row_vals = []
        for c in sample_cols:
            val = str(row[c])
            if len(val) > 25:
                val = val[:22] + "..."
            row_vals.append(val)
        sample_data.append(row_vals)

    t3 = Table(sample_data, colWidths=[100] * len(sample_cols))
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#4A5568')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 4),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E0')),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F7FAFC')]),
    ]))
    story.append(t3)
    
    doc.build(story)
    pdf_buffer.seek(0)
    
    response = StreamingResponse(pdf_buffer, media_type="application/pdf")
    response.headers["Content-Disposition"] = f"attachment; filename=quality_report_{id}.pdf"
    return response
