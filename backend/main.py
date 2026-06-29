from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routes import auth, datasets, cleaning, reports, analytics, predictions, chatbot

# Create tables if they do not exist
# Note: Base.metadata.create_all won't drop or alter existing tables,
# it will just create missing tables like dashboard_configs
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Data Platform API",
    description="Backend for AI-Powered Data Cleaning, Reporting, & BI Automation",
    version="1.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from Vite development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(cleaning.router)
app.include_router(reports.router)
app.include_router(analytics.router)
app.include_router(predictions.router)
app.include_router(chatbot.router)

@app.get("/")
def home():
    return {
        "status": "Online",
        "message": "AI-Powered Smart Data Platform Backend is running successfully",
        "swagger_docs": "/docs"
    }