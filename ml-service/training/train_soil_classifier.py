"""
CropAI – Soil Type Classifier Trainer
Extracts color statistics + color histograms + spatial moments from soil images.
Trains Random Forest + SVM Ensemble to classify 5 soil types:
- Black Soil
- Cinder Soil
- Laterite Soil
- Peat Soil
- Yellow Soil
Saves model artifacts to ml-service/models/
"""

import os
import json
import joblib
import numpy as np
from PIL import Image
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from sklearn.svm import SVC
from sklearn.ensemble import VotingClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOIL_DIR = r"C:\Users\Lavanya\.gemini\antigravity\scratch\crop_recommendation_system\data\extracted\soil\Soil types"
MODEL_DIR = os.path.join(BASE_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

def extract_features(img_path):
    """
    Extract color & texture features from a soil image:
    1. Resized RGB pixel values (mean, std, min, max per channel)
    2. Color histogram (RGB 8 bins per channel = 24 features)
    3. HSV color histogram (24 features)
    4. Grayscale edge statistics (gradient magnitude)
    """
    img = Image.open(img_path).convert('RGB').resize((128, 128))
    arr = np.array(img, dtype=np.float32)

    # 1. Channel means & stds
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    means = [r.mean(), g.mean(), b.mean()]
    stds  = [r.std(), g.std(), b.std()]
    p10   = [np.percentile(r, 10), np.percentile(g, 10), np.percentile(b, 10)]
    p90   = [np.percentile(r, 90), np.percentile(g, 90), np.percentile(b, 90)]

    # 2. RGB histograms
    hist_r, _ = np.histogram(r, bins=16, range=(0, 256), density=True)
    hist_g, _ = np.histogram(g, bins=16, range=(0, 256), density=True)
    hist_b, _ = np.histogram(b, bins=16, range=(0, 256), density=True)

    # 3. HSV conversion
    hsv_img = img.convert('HSV')
    hsv_arr = np.array(hsv_img, dtype=np.float32)
    h, s, v = hsv_arr[:, :, 0], hsv_arr[:, :, 1], hsv_arr[:, :, 2]
    hsv_means = [h.mean(), s.mean(), v.mean()]
    hsv_stds  = [h.std(), s.std(), v.std()]
    hist_h, _ = np.histogram(h, bins=16, range=(0, 256), density=True)
    hist_s, _ = np.histogram(s, bins=16, range=(0, 256), density=True)

    # 4. Texture / Gradient features (simple Sobel-like diff)
    gray = np.array(img.convert('L'), dtype=np.float32)
    dx = np.abs(np.diff(gray, axis=1))
    dy = np.abs(np.diff(gray, axis=0))
    edge_mean = [dx.mean(), dy.mean()]
    edge_std  = [dx.std(), dy.std()]

    # Combine all features into 1D vector
    feat = np.concatenate([
        means, stds, p10, p90,
        hist_r, hist_g, hist_b,
        hsv_means, hsv_stds,
        hist_h, hist_s,
        edge_mean, edge_std
    ])
    return feat

def main():
    print("=" * 60)
    print("  CropAI – Soil Type Classifier Trainer")
    print("=" * 60)

    X = []
    y_labels = []

    classes = [d for d in os.listdir(SOIL_DIR) if os.path.isdir(os.path.join(SOIL_DIR, d))]
    classes.sort()

    print(f"\n[1/4] Loading soil images from {SOIL_DIR} ...")
    for cls in classes:
        cls_dir = os.path.join(SOIL_DIR, cls)
        files = [f for f in os.listdir(cls_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        print(f"  - {cls}: {len(files)} images")
        for f in files:
            imgPath = os.path.join(cls_dir, f)
            try:
                feat = extract_features(imgPath)
                X.append(feat)
                y_labels.append(cls)
            except Exception as e:
                print(f"    Warning: Error reading {f}: {e}")

    X = np.array(X)
    y_labels = np.array(y_labels)
    print(f"\n  Total samples: {len(X)}, Feature dimension: {X.shape[1]}")

    le = LabelEncoder()
    y = le.fit_transform(y_labels)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.25, random_state=42, stratify=y
    )

    print("\n[2/4] Training ensemble model (Random Forest + Extra Trees + SVM) ...")
    rf = RandomForestClassifier(n_estimators=150, max_depth=8, random_state=42)
    et = ExtraTreesClassifier(n_estimators=150, random_state=42)
    svm = SVC(probability=True, kernel='rbf', C=10, random_state=42)

    ensemble = VotingClassifier(
        estimators=[('rf', rf), ('et', et), ('svm', svm)],
        voting='soft'
    )
    ensemble.fit(X_train, y_train)

    y_pred = ensemble.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    cv_scores = cross_val_score(ensemble, X_scaled, y, cv=5)

    print(f"  Test Accuracy : {acc * 100:.2f}%")
    print(f"  5-Fold CV Mean: {cv_scores.mean() * 100:.2f}% ± {cv_scores.std() * 100:.2f}%")
    print("\n  Classification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    print("\n[3/4] Saving model artifacts ...")
    joblib.dump(ensemble, os.path.join(MODEL_DIR, 'soil_classifier.joblib'))
    joblib.dump(scaler,   os.path.join(MODEL_DIR, 'soil_scaler.joblib'))
    joblib.dump(le,       os.path.join(MODEL_DIR, 'soil_label_encoder.joblib'))

    metrics = {
        "accuracy": round(float(acc), 4),
        "cv_accuracy": round(float(cv_scores.mean()), 4),
        "classes": list(le.classes_),
        "n_samples": len(X),
        "feature_dim": int(X.shape[1])
    }
    with open(os.path.join(MODEL_DIR, 'soil_classifier_metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)

    print(f"  Saved artifacts to: {MODEL_DIR}")
    print("[OK] Soil Classifier Training Complete.")

if __name__ == '__main__':
    main()
