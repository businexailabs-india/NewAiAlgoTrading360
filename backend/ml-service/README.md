# SmartTrade Python ML Sidecar

Local training engine using **FastAPI + pandas + scikit-learn**.

## Run locally

```bash
cd backend/ml-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8081 --reload
```

Set in backend `.env`:
```
ML_SERVICE_URL=http://localhost:8081
USE_PYTHON_ML=true
```

## Docker (with backend)

```bash
cd backend
docker compose up ml-service backend
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Service health |
| `POST /train` | Train GradientBoosting model per symbol |
| `POST /predict` | Run inference |

## Node integration

Create engine with `engineType: "sklearn"` or `"ml_regression"` (when ML service is up):

```
POST /api/predictions/engines
{ "name": "Python ML", "engineType": "sklearn", "symbols": ["RELIANCE","TCS"] }
POST /api/predictions/engines/:id/train
```

Check status: `GET /api/predictions/ml-status`

Models saved to `/app/models/{engineId}_{symbol}.joblib`.
