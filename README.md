# AppShield AI - Fraudulent Android App Detection Platform

AppShield AI is a full-stack Android fraud-risk scanner. It combines Play Store
metadata, reviews, APK static analysis, developer/certificate checks, icon and
screenshot similarity, feature fusion, benchmarked ML models, and explainable
risk output.

## Current Status

| Area | Status |
| --- | --- |
| Frontend | Built with Next.js, TypeScript, Tailwind, Recharts, and lucide-react. |
| Backend API | Built with FastAPI routers for scans, models, datasets, reports, and auth. |
| ML pipeline | Trains and serves Random Forest, XGBoost, LightGBM, and CatBoost models. |
| Saved models | Included under `backend/app/ml/trained_models` in this workspace. |
| Play Store input | Uses `google-play-scraper` for metadata/reviews and downloads icon/screenshot bytes when available. |
| APK upload / APK URL input | Uses Androguard to parse APK package, manifest, permissions, API calls, SDK values, and icon bytes. |
| Hash lookup | Works after an APK upload or APK URL scan has stored the APK SHA256 in MongoDB. |
| Admin auth | JWT login protects training and dataset-management endpoints. |
| Review analysis | Uses local TF-IDF/LogisticRegression classifier when labeled review data exists, with heuristic fallback. |
| Icon analysis | Uses MobileNet embeddings when available, with OpenCV visual-descriptor fallback. |
| Screenshot analysis | Uses perceptual hash matching against trusted screenshot references. |
| Training data | Synthetic training data is available for development; replace it with the real fused dataset before production claims. |

## Project Layout

```text
appshield-ai/
  backend/
    app/
      db/          MongoDB connection (scans, reports, users)
      fusion/      feature-vector builder
      ml/          training, registry, SHAP/fallback explanations
      modules/     independent risk modules
      routers/     scan, auth, model, dataset, report APIs
      utils/       Play Store scraper and APK downloader
  datasets/        raw and processed dataset folders
  frontend/
    app/           dashboard, research, scan, datasets, history pages
    components/    shared UI components
    lib/           API client and shared types
```

## Prerequisites

- Node.js 18+.
- Python 3.11 or 3.12 recommended. Python 3.13 may not have compatible wheels for every ML dependency.
- MongoDB (Community Server / Service running locally on port 27017 or a MongoDB Atlas URI).

On Windows PowerShell, prefer `npm.cmd` instead of `npm` if script execution is disabled.

## One-Time Setup

Open a terminal in this folder:

```powershell
cd D:\Vs_Code_Workspace\fraud-app-detector\appshield-ai
```

Make sure your local MongoDB service is running:

```powershell
# E.g. on Windows
Get-Service -Name MongoDB
# or start it if stopped:
# Start-Service -Name MongoDB
```

Create backend environment:

```powershell
cd backend
py -3.12 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

If `py -3.12` is not installed, install Python 3.12 first or use `py -3.11`.

Install frontend dependencies:

```powershell
cd ..\frontend
npm.cmd install
Copy-Item .env.local.example .env.local
```

## Running The Project

### One Command On Windows

After completing the one-time setup, start everything from the project root:

```powershell
cd D:\Vs_Code_Workspace\fraud-app-detector\appshield-ai
.\start-dev.cmd
```

This starts:

- Local MongoDB verification (port 27017)
- Backend API: `http://localhost:8000`
- Frontend app: `http://localhost:3000`

Keep the backend and frontend terminal windows open while using the app.

Open:

```text
http://localhost:3000
```

### Manual Fallback

Use these commands only if you want to run each part yourself.

Terminal 1 - database (if not running as a Windows service):

```powershell
# Verify MongoDB status
net start MongoDB
```

Terminal 2 - backend:

```powershell
cd D:\Vs_Code_Workspace\fraud-app-detector\appshield-ai\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Backend health check:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Terminal 3 - frontend:

```powershell
cd D:\Vs_Code_Workspace\fraud-app-detector\appshield-ai\frontend
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

The root page redirects to `/dashboard`.

## What To Do In The App

1. Open **Dashboard** to see the latest scan summary, module scores, risk gauge, model probabilities, and explanations.
2. Open **New Scan** to run a scan using one of five inputs:
   - Play Store URL, for example `https://play.google.com/store/apps/details?id=com.whatsapp`
   - APK download URL
   - APK upload
   - Package name, for example `com.whatsapp`
   - SHA256 hash from a previously scanned APK
3. Open **Scan History** to review reports saved in MongoDB.
4. Open **Research Mode** to compare available models and trigger retraining.
5. Open **Datasets** to upload or remove module datasets.

Default admin login:

```text
username: admin
password: admin123
```

Change `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SECRET_KEY` in `backend/.env`
before using this outside local development.

The default local MongoDB database URL is:

```text
MONGO_URL=mongodb://localhost:27017
MONGO_DB=appshield_reports
```

## Model Training

This workspace already contains trained development models. To regenerate the
synthetic training data and retrain locally:

```powershell
cd D:\Vs_Code_Workspace\fraud-app-detector\appshield-ai\backend
.\venv\Scripts\Activate.ps1
python -m app.ml.seed_synthetic_data
python -m app.ml.train_models
```

From the UI, log in as admin in Research Mode or Datasets, then use the training
controls. The API endpoints are:

```text
POST /api/models/train
GET  /api/models/train/status
GET  /api/models/available
GET  /api/models/benchmark
```

## Verification Commands

Backend syntax:

```powershell
cd D:\Vs_Code_Workspace\fraud-app-detector\appshield-ai
backend\venv\Scripts\python.exe -m compileall backend\app
```

Backend import smoke test:

```powershell
cd D:\Vs_Code_Workspace\fraud-app-detector\appshield-ai\backend
.\venv\Scripts\Activate.ps1
python -c "from app.main import app; print(app.title)"
python -c "from app.ml import model_registry; print(model_registry.available_models()); print(model_registry.get_best_model_name())"
```

Frontend production build:

```powershell
cd D:\Vs_Code_Workspace\fraud-app-detector\appshield-ai\frontend
npm.cmd run build
```

## Production Notes

- Replace synthetic `datasets/combined/processed/training_data.csv` with a real fused dataset.
- Add trusted icon files under `datasets/icons/raw` and trusted screenshots under `datasets/screenshots/raw` for stronger clone detection.
- Use a production secret key and non-default admin credentials.
- Use managed MongoDB (e.g. MongoDB Atlas) or secure the local MongoDB instance with authentication.
- Play Store scraping can be fragile; for production scale, use a licensed app-intelligence API or an official integration where possible.
