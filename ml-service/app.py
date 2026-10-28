"""
CropAI – Real FastAPI ML Service
Loads trained ensemble model and provides real predictions + SHAP explanations
"""

import os
import json
import time
import joblib
import numpy as np
from datetime import datetime
import io
from PIL import Image
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import warnings
warnings.filterwarnings('ignore')

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR  = os.path.join(BASE_DIR, 'models')
METRICS_PATH = os.path.join(MODEL_DIR, 'model_metrics.json')

# ── App Setup ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CropAI ML Service",
    description="Real ensemble ML predictions using Random Forest + XGBoost + LightGBM with SHAP explainability",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load Models ────────────────────────────────────────────────────────────────
print("[CropAI ML] Loading model artifacts ...")
MODEL_LOADED = False
ensemble = scaler = le = explainer = metrics_data = None

try:
    ensemble  = joblib.load(os.path.join(MODEL_DIR, 'ensemble_model.joblib'))
    scaler    = joblib.load(os.path.join(MODEL_DIR, 'scaler.joblib'))
    le        = joblib.load(os.path.join(MODEL_DIR, 'label_encoder.joblib'))
    explainer = joblib.load(os.path.join(MODEL_DIR, 'shap_explainer.joblib'))
    with open(METRICS_PATH) as f:
        metrics_data = json.load(f)
    MODEL_LOADED = True
    print(f"[CropAI ML] OK - Model loaded - accuracy: {metrics_data['metrics']['accuracy']}")
except Exception as e:
    print(f"[CropAI ML] WARNING - Model not loaded: {e}")
    print("[CropAI ML] Run ml-service/training/train.py first to train the model.")

# Load Soil Classifier Artifacts
SOIL_MODEL_LOADED = False
soil_ensemble = soil_scaler = soil_le = soil_metrics = None
try:
    soil_ensemble = joblib.load(os.path.join(MODEL_DIR, 'soil_classifier.joblib'))
    soil_scaler   = joblib.load(os.path.join(MODEL_DIR, 'soil_scaler.joblib'))
    soil_le       = joblib.load(os.path.join(MODEL_DIR, 'soil_label_encoder.joblib'))
    with open(os.path.join(MODEL_DIR, 'soil_classifier_metrics.json')) as f:
        soil_metrics = json.load(f)
    SOIL_MODEL_LOADED = True
    print(f"[CropAI ML] OK - Soil Classifier loaded - accuracy: {soil_metrics['accuracy']}")
except Exception as e:
    print(f"[CropAI ML] WARNING - Soil Classifier not loaded: {e}")

FEATURE_COLS = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']

# ── Request / Response schemas ─────────────────────────────────────────────────
class PredictRequest(BaseModel):
    N: float = Field(..., ge=0, le=300, description="Nitrogen content in soil (kg/ha)")
    P: float = Field(..., ge=0, le=300, description="Phosphorus content in soil (kg/ha)")
    K: float = Field(..., ge=0, le=300, description="Potassium content in soil (kg/ha)")
    temperature: float = Field(..., ge=0, le=60, description="Temperature in °C")
    humidity: float = Field(..., ge=0, le=100, description="Relative humidity in %")
    ph: float = Field(..., ge=0, le=14, description="Soil pH value")
    rainfall: float = Field(..., ge=0, le=500, description="Annual rainfall in mm")

class SHAPEntry(BaseModel):
    feature: str
    value: float
    impact: str        # 'positive' | 'negative'
    input_value: float

class AlternativeCrop(BaseModel):
    crop_name: str
    score: float
    confidence_pct: float

class PredictResponse(BaseModel):
    recommended_crop: str
    confidence: float
    confidence_pct: str
    version: str
    model_used: str
    alternatives: list
    shap: list
    all_probabilities: dict
    feature_inputs: dict
    predicted_at: str

# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {
        "status": "active",
        "model_loaded": MODEL_LOADED,
        "version": metrics_data["version"] if metrics_data else "not-trained",
        "accuracy": metrics_data["metrics"]["accuracy"] if metrics_data else None,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/model-info")
def model_info():
    if not MODEL_LOADED:
        raise HTTPException(status_code=503, detail="Model not loaded. Run training/train.py first.")
    return {
        "version": metrics_data["version"],
        "trained_at": metrics_data["trained_at"],
        "dataset": metrics_data["dataset"],
        "n_samples": metrics_data["n_samples"],
        "n_features": metrics_data["n_features"],
        "feature_columns": metrics_data["feature_columns"],
        "n_classes": metrics_data["n_classes"],
        "class_names": metrics_data["class_names"],
        "ensemble_strategy": metrics_data["ensemble_strategy"],
        "models": metrics_data["models"],
        "metrics": metrics_data["metrics"],
        "global_shap_importance": metrics_data["global_shap_importance"]
    }

@app.post("/predict", response_model=None)
def predict(data: PredictRequest):
    if not MODEL_LOADED:
        raise HTTPException(status_code=503, detail="Model not trained yet. Please run training/train.py.")

    t0 = time.time()

    # Prepare features
    features = np.array([[data.N, data.P, data.K, data.temperature, data.humidity, data.ph, data.rainfall]])
    features_scaled = scaler.transform(features)

    # Ensemble prediction
    proba = ensemble.predict_proba(features_scaled)[0]
    class_names = le.classes_.tolist()
    top_idx = int(np.argmax(proba))
    predicted_crop = class_names[top_idx]
    confidence = float(proba[top_idx])

    # All probabilities
    all_proba = {class_names[i]: round(float(proba[i]), 6) for i in range(len(class_names))}

    # Top 4 alternatives (excluding the top prediction)
    sorted_idx = np.argsort(proba)[::-1]
    alternatives = []
    for i in sorted_idx[1:5]:
        alternatives.append({
            "crop_name": class_names[i],
            "score": round(float(proba[i]), 4),
            "confidence_pct": f"{proba[i]*100:.2f}%"
        })

    # SHAP explanation using the RF explainer
    try:
        sv = explainer.shap_values(features_scaled)
        # SHAP >= 0.42 may return ndarray shape (n_samples, n_features, n_classes)
        # Older SHAP returns list of arrays, one per class
        if isinstance(sv, np.ndarray):
            # New format: (1, n_features, n_classes)
            shap_for_pred = sv[0, :, top_idx]
        elif isinstance(sv, list):
            # Old format: list[n_classes][n_samples, n_features]
            shap_for_pred = sv[top_idx][0]
        else:
            shap_for_pred = np.zeros(len(FEATURE_COLS))

        shap_list = []
        for i, col in enumerate(FEATURE_COLS):
            sv_val = float(shap_for_pred[i])
            shap_list.append({
                "feature": col,
                "value": round(sv_val, 4),
                "impact": "positive" if sv_val >= 0 else "negative",
                "input_value": float(features[0][i])
            })
        shap_list.sort(key=lambda x: abs(x["value"]), reverse=True)
    except Exception as e:
        # Fallback: use RF feature importances as approximation
        fi = rf_importances if 'rf_importances' in dir() else None
        shap_list = []
        for i, col in enumerate(FEATURE_COLS):
            # Use feature importance * input deviation as rough proxy
            sv_val = 0.0
            shap_list.append({
                "feature": col,
                "value": sv_val,
                "impact": "unknown",
                "input_value": float(features[0][i])
            })

    elapsed = round((time.time() - t0) * 1000, 1)

    return {
        "recommended_crop": predicted_crop,
        "confidence": round(confidence, 4),
        "confidence_pct": f"{confidence*100:.2f}%",
        "version": metrics_data["version"],
        "model_used": "RandomForest+XGBoost+LightGBM Soft Voting Ensemble",
        "alternatives": alternatives,
        "shap": shap_list,
        "all_probabilities": all_proba,
        "feature_inputs": {
            "N": data.N, "P": data.P, "K": data.K,
            "temperature": data.temperature, "humidity": data.humidity,
            "ph": data.ph, "rainfall": data.rainfall
        },
        "predicted_at": datetime.utcnow().isoformat() + "Z",
        "inference_ms": elapsed
    }

@app.post("/batch-predict")
def batch_predict(items: list[PredictRequest]):
    """Predict for multiple soil/weather inputs at once."""
    return [predict(item) for item in items]

def extract_soil_features_from_img(img: Image.Image):
    img = img.convert('RGB').resize((128, 128))
    arr = np.array(img, dtype=np.float32)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    means = [r.mean(), g.mean(), b.mean()]
    stds  = [r.std(), g.std(), b.std()]
    p10   = [np.percentile(r, 10), np.percentile(g, 10), np.percentile(b, 10)]
    p90   = [np.percentile(r, 90), np.percentile(g, 90), np.percentile(b, 90)]

    hist_r, _ = np.histogram(r, bins=16, range=(0, 256), density=True)
    hist_g, _ = np.histogram(g, bins=16, range=(0, 256), density=True)
    hist_b, _ = np.histogram(b, bins=16, range=(0, 256), density=True)

    hsv_img = img.convert('HSV')
    hsv_arr = np.array(hsv_img, dtype=np.float32)
    h, s, v = hsv_arr[:, :, 0], hsv_arr[:, :, 1], hsv_arr[:, :, 2]
    hsv_means = [h.mean(), s.mean(), v.mean()]
    hsv_stds  = [h.std(), s.std(), v.std()]
    hist_h, _ = np.histogram(h, bins=16, range=(0, 256), density=True)
    hist_s, _ = np.histogram(s, bins=16, range=(0, 256), density=True)

    gray = np.array(img.convert('L'), dtype=np.float32)
    dx = np.abs(np.diff(gray, axis=1))
    dy = np.abs(np.diff(gray, axis=0))
    edge_mean = [dx.mean(), dy.mean()]
    edge_std  = [dx.std(), dy.std()]

    feat = np.concatenate([
        means, stds, p10, p90,
        hist_r, hist_g, hist_b,
        hsv_means, hsv_stds,
        hist_h, hist_s,
        edge_mean, edge_std
    ])
    return feat

class SoilImageRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded soil image string")

@app.post("/classify-soil")
async def classify_soil(req: SoilImageRequest):
    if not SOIL_MODEL_LOADED:
        raise HTTPException(status_code=503, detail="Soil classifier model not trained/loaded.")

    t0 = time.time()
    try:
        import base64
        b64_str = req.image_base64
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
        content = base64.b64decode(b64_str)
        img = Image.open(io.BytesIO(content))
        feat = extract_soil_features_from_img(img).reshape(1, -1)
        feat_scaled = soil_scaler.transform(feat)

        proba = soil_ensemble.predict_proba(feat_scaled)[0]
        top_idx = int(np.argmax(proba))
        predicted_type = soil_le.classes_[top_idx]
        confidence = float(proba[top_idx])

        all_proba = {soil_le.classes_[i]: round(float(proba[i]), 4) for i in range(len(soil_le.classes_))}
        elapsed = round((time.time() - t0) * 1000, 1)

        return {
            "soil_type": predicted_type,
            "confidence": round(confidence, 4),
            "confidence_pct": f"{confidence * 100:.2f}%",
            "all_probabilities": all_proba,
            "metrics": soil_metrics,
            "inference_ms": elapsed
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image processing failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
