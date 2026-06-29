# SmartData | AI-Powered Smart Data Platform

SmartData is an advanced, production-grade AI-powered data management, cleaning, predictive modeling, and BI automation platform. It features a complete FastAPI Python backend combined with a responsive, glassmorphic React and Tailwind CSS v4 frontend.

## 🚀 Key Features

- **User Authentication & RBAC**: Session-persistent login/register flow with role-based routing (Analyst, Admin, Viewer).
- **Interactive Dataset Profiling**: Automated analysis of uploaded CSV/Excel files including row/column shapes, data types, missing value percentages, duplicate checks, and summary statistics.
- **Automated Data Cleaning Engine**: Imputes missing values, trims text whitespace, standardizes date formats, normalizes column headers into `snake_case`, and performs outlier handling (IQR and Z-Score).
- **Warehouse SQL Integration**: Cleaned datasets are dynamically saved into dedicated tables in the SQL warehouse.
- **Natural Language Query Chatbot**: Conversational English-to-SQL compiler allowing users to query, sum, average, or preview dataset warehouse tables without writing code.
- **Predictive Analytics Sandbox**: Multi-task machine learning interface (Regression, Classification, Clustering) using scikit-learn. Includes feature importance graphing and residual performance tables.
- **BI Visualizations & PDF Reports**: Interactive descriptive statistics tables, correlation matrices, and automated PDF Quality Report downloads.

---

## 🛠️ Technology Stack

* **Backend**: FastAPI, Uvicorn, SQLAlchemy, PyMySQL, Pandas, NumPy, Scikit-learn, ReportLab, JWT, Passlib.
* **Frontend**: React (v19), Vite (v8), Tailwind CSS (v4), Axios, Chart.js, React Router DOM.
* **Database**: MySQL.

---

## 📦 File Structure

The project workspace is organized as follows:

```text
smart-data-platform/
├── backend/
│   ├── app/                      # Application placeholder
│   ├── models/
│   │   └── models.py             # SQLAlchemy models (User, Dataset, CleaningLog, etc.)
│   ├── routes/
│   │   ├── auth.py               # Authentication and session endpoints
│   │   ├── datasets.py           # Dataset metadata, upload, and profiling
│   │   ├── cleaning.py           # Cleaning processor and quality scoring triggers
│   │   ├── reports.py            # PDF generation and CSV/XLSX exports
│   │   ├── analytics.py          # Summary metrics, AI insights, correlations
│   │   ├── predictions.py        # Machine learning modeling (regression, clustering, etc.)
│   │   └── chatbot.py            # Conversational SQL compilation router
│   ├── services/
│   │   ├── cleaning_service.py   # Data formatting, deduplication, and imputations
│   │   ├── quality_service.py    # Metric weights (completeness, uniqueness, etc.)
│   │   └── warehouse_service.py  # MySQL read/write layers and index managers
│   ├── utils/
│   │   ├── schemas.py            # Pydantic validation schemas
│   │   └── security.py           # Bcrypt hashing and JWT handlers
│   ├── database.py               # Engine creation and SessionLocal helpers
│   ├── main.py                   # FastAPI entrypoint and router registry
│   ├── requirements.txt          # Python packages list
│   └── .env.example              # Config variables template
├── frontend/
│   └── frontend/
│       ├── src/
│       │   ├── components/
│       │   │   └── Sidebar.jsx       # Left nav bar & profile status
│       │   ├── pages/
│       │   │   ├── Login.jsx         # Sign in template
│       │   │   ├── Register.jsx      # Create account selector
│       │   │   ├── Dashboard.jsx     # Aggregated KPIs and log stream
│       │   │   ├── Datasets.jsx      # Main tabbed workspace (Profile, Clean, ML, BI)
│       │   │   └── Chatbot.jsx       # NLP-to-SQL chat tab
│       │   ├── App.jsx               # Navigation router & state handlers
│       │   ├── index.css             # Main styling, typography, and glassmorphic designs
│       │   └── main.jsx              # React initialization
│       ├── package.json          # Node script commands
│       └── vite.config.js        # Vite configurations
└── datasets/
    └── messy_data.csv            # Sample CSV dataset for testing
```

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL Server running locally or accessible via network

---

### 1. Database Setup

Create a new MySQL database named `smart_data_platform`:
```sql
CREATE DATABASE smart_data_platform;
```

---

### 2. Backend Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment variables template and configure it:
   ```bash
   copy .env.example .env
   ```
   Open `.env` and verify that the database credentials in `DATABASE_URL` match your MySQL setup.
5. Start the FastAPI development server:
   ```bash
   uvicorn main:app --reload
   ```
   *Note: Database tables will be automatically created on the first start of the API.*

---

### 3. Frontend Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend/frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the application in your browser at `http://localhost:5173`.
