"""
CropAI - Real ML Training Pipeline
Trains an ensemble model (RF + XGBoost + LightGBM) on actual Crop_recommendation.csv
Computes SHAP values, saves all artifacts to ml-service/models/
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (accuracy_score, f1_score, classification_report,
                             confusion_matrix)
import xgboost as xgb
import lightgbm as lgb
import shap
import warnings
warnings.filterwarnings('ignore')

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, '..', 'data', 'raw', 'Crop_recommendation.csv')
MODEL_DIR  = os.path.join(BASE_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

print("=" * 60)
print("  CropAI – ML Training Pipeline")
print("=" * 60)

# ── 1. Load Dataset ────────────────────────────────────────────────────────────
print("\n[1/7] Loading dataset …")
df = pd.read_csv(DATA_PATH)
print(f"  Rows: {len(df)}, Columns: {list(df.columns)}")
print(f"  Missing values:\n{df.isnull().sum()}")
print(f"  Crops ({df['label'].nunique()}): {sorted(df['label'].unique())}")

# ── 2. Preprocess ──────────────────────────────────────────────────────────────
print("\n[2/7] Preprocessing …")
FEATURE_COLS = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
TARGET_COL   = 'label'

X = df[FEATURE_COLS].values
y_raw = df[TARGET_COL].values

# Label encode target
le = LabelEncoder()
y = le.fit_transform(y_raw)
class_names = le.classes_.tolist()
print(f"  Classes: {class_names}")

# Scale features (needed by some models)
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Train / test split (80/20, stratified)
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.20, random_state=42, stratify=y
)
print(f"  Train: {len(X_train)}, Test: {len(X_test)}")

# ── 3. Train individual models ─────────────────────────────────────────────────
print("\n[3/7] Training individual models …")

rf = RandomForestClassifier(
    n_estimators=200, max_depth=None, min_samples_split=2,
    random_state=42, n_jobs=-1, class_weight='balanced'
)
rf.fit(X_train, y_train)
rf_acc = accuracy_score(y_test, rf.predict(X_test))
print(f"  Random Forest   accuracy: {rf_acc:.4f}")

xgb_model = xgb.XGBClassifier(
    n_estimators=200, max_depth=6, learning_rate=0.1,
    use_label_encoder=False, eval_metric='mlogloss',
    random_state=42, n_jobs=-1
)
xgb_model.fit(X_train, y_train)
xgb_acc = accuracy_score(y_test, xgb_model.predict(X_test))
print(f"  XGBoost         accuracy: {xgb_acc:.4f}")

lgb_model = lgb.LGBMClassifier(
    n_estimators=200, max_depth=-1, learning_rate=0.1,
    random_state=42, n_jobs=-1, verbose=-1
)
lgb_model.fit(X_train, y_train)
lgb_acc = accuracy_score(y_test, lgb_model.predict(X_test))
print(f"  LightGBM        accuracy: {lgb_acc:.4f}")

# ── 4. Ensemble (soft voting) ──────────────────────────────────────────────────
print("\n[4/7] Building soft-voting ensemble …")
ensemble = VotingClassifier(
    estimators=[('rf', rf), ('xgb', xgb_model), ('lgb', lgb_model)],
    voting='soft'
)
ensemble.fit(X_train, y_train)
y_pred = ensemble.predict(X_test)
ens_acc = accuracy_score(y_test, y_pred)
ens_f1  = f1_score(y_test, y_pred, average='weighted')
print(f"  Ensemble accuracy : {ens_acc:.4f}")
print(f"  Ensemble F1 (wtd) : {ens_f1:.4f}")

# 5-fold CV on full scaled data
cv_scores = cross_val_score(ensemble, X_scaled, y, cv=5, scoring='accuracy', n_jobs=-1)
print(f"  5-fold CV mean    : {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

report = classification_report(y_test, y_pred, target_names=class_names, output_dict=True)

# ── 5. SHAP explainability (using RF as surrogate – fastest) ──────────────────
print("\n[5/7] Computing SHAP values (TreeExplainer on RF) …")
explainer = shap.TreeExplainer(rf)
shap_values = explainer.shap_values(X_test)          # shape: (n_classes, n_samples, n_features)

# Mean absolute SHAP per feature across all classes
mean_abs_shap = np.mean([np.abs(shap_values[c]).mean(axis=0) for c in range(len(class_names))], axis=0)
global_shap = {FEATURE_COLS[i]: float(mean_abs_shap[i]) for i in range(len(FEATURE_COLS))}
print(f"  Global SHAP importances: {global_shap}")

# ── 6. Save artifacts ──────────────────────────────────────────────────────────
print("\n[6/7] Saving model artifacts …")

joblib.dump(ensemble,  os.path.join(MODEL_DIR, 'ensemble_model.joblib'))
joblib.dump(rf,        os.path.join(MODEL_DIR, 'rf_model.joblib'))
joblib.dump(scaler,    os.path.join(MODEL_DIR, 'scaler.joblib'))
joblib.dump(le,        os.path.join(MODEL_DIR, 'label_encoder.joblib'))
joblib.dump(explainer, os.path.join(MODEL_DIR, 'shap_explainer.joblib'))

# Save shap_values for X_test reference
np.save(os.path.join(MODEL_DIR, 'shap_values_test.npy'), np.array(shap_values))
np.save(os.path.join(MODEL_DIR, 'X_test.npy'), X_test)

metrics = {
    "version": "ensemble-v2.0",
    "trained_at": datetime.utcnow().isoformat() + "Z",
    "dataset": "Crop_recommendation.csv",
    "n_samples": int(len(df)),
    "n_features": len(FEATURE_COLS),
    "feature_columns": FEATURE_COLS,
    "class_names": class_names,
    "n_classes": len(class_names),
    "models": ["RandomForest", "XGBoost", "LightGBM"],
    "ensemble_strategy": "soft_voting",
    "metrics": {
        "accuracy": round(float(ens_acc), 4),
        "f1_score_weighted": round(float(ens_f1), 4),
        "cv_mean_accuracy": round(float(cv_scores.mean()), 4),
        "cv_std": round(float(cv_scores.std()), 4),
        "random_forest_accuracy": round(float(rf_acc), 4),
        "xgboost_accuracy": round(float(xgb_acc), 4),
        "lightgbm_accuracy": round(float(lgb_acc), 4),
        "per_class_f1": {c: round(report[c]['f1-score'], 4) for c in class_names}
    },
    "global_shap_importance": global_shap
}
with open(os.path.join(MODEL_DIR, 'model_metrics.json'), 'w') as f:
    json.dump(metrics, f, indent=2)

print(f"  Saved: {os.listdir(MODEL_DIR)}")

# ── 7. Verify inference round-trip ─────────────────────────────────────────────
print("\n[7/7] Verifying inference …")
sample = np.array([[90, 42, 43, 20.87, 82.0, 6.5, 202.93]])   # typical rice input
sample_scaled = scaler.transform(sample)
proba = ensemble.predict_proba(sample_scaled)[0]
top_idx = np.argsort(proba)[::-1][:5]
print("  Top-5 predictions for sample (N=90, P=42, K=43, T=20.87, H=82, pH=6.5, R=202.93):")
for i in top_idx:
    print(f"    {class_names[i]:15s}: {proba[i]*100:.2f}%")

# SHAP for single sample
sv_single = explainer.shap_values(sample_scaled)
# TreeExplainer returns list[n_classes][n_samples, n_features] OR array[n_samples, n_features, n_classes]
pred_class = top_idx[0]
try:
    if isinstance(sv_single, list):
        shap_for_pred = sv_single[pred_class][0]
    else:
        shap_for_pred = sv_single[0, :, pred_class]
    shap_dict = {FEATURE_COLS[i]: round(float(shap_for_pred[i]), 4) for i in range(len(FEATURE_COLS))}
    print(f"  SHAP for predicted class '{class_names[pred_class]}': {shap_dict}")
except Exception as e:
    print(f"  SHAP verification skipped: {e}")

print("\n✅  Training complete. All artifacts saved to ml-service/models/")
print(f"   Ensemble accuracy: {ens_acc*100:.2f}%")
