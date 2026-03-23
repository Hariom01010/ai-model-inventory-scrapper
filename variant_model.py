import os
import json
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from xgboost import XGBClassifier

# ================================
# CONFIG
# ================================
DATA_DIR = "data/product_variants"
MODEL_PATH = "variant_model.pkl"

# ================================
# 1. LOAD DATA
# ================================
all_data = []

for file in os.listdir(DATA_DIR):
    if not file.endswith(".json"):
        continue

    path = os.path.join(DATA_DIR, file)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

        labeled = [el for el in data if "label" in el]
        all_data.extend(labeled)

print(f"[INFO] Total labeled samples: {len(all_data)}")

if len(all_data) == 0:
    raise Exception("No labeled data found!")

# ================================
# 2. FEATURE ENGINEERING
# ================================

TAGS = ["button", "div", "span", "input", "label", "li", "option"]

def encode_tag(tag):
    return [1 if tag == t else 0 for t in TAGS]

X = []
y = []

for el in all_data:
    features = []

    # ---- Tag Encoding ----
    features.extend(encode_tag(el.get("tag", "")))

    # ---- Numeric Features ----
    features.extend([
        el.get("textLength", 0),
        el.get("isClickable", 0),
        el.get("childCount", 0),
        el.get("siblingCount", 0),

        el.get("class_contains_variant", 0),
        el.get("class_contains_option", 0),
        el.get("class_contains_size", 0),
        el.get("class_contains_color", 0),
        el.get("class_contains_swatch", 0),

        el.get("isSingleWord", 0),
        el.get("isShortText", 0),

        el.get("area", 0)
    ])

    X.append(features)
    y.append(el["label"])

X = np.array(X)
y = np.array(y)

print(f"[INFO] Feature shape: {X.shape}")

# ================================
# 3. TRAIN / TEST SPLIT
# ================================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ================================
# 4. HANDLE IMBALANCE
# ================================
pos = sum(y_train)
neg = len(y_train) - pos

scale_pos_weight = neg / pos if pos > 0 else 1

print(f"[INFO] Positives: {pos}, Negatives: {neg}")
print(f"[INFO] scale_pos_weight: {scale_pos_weight:.2f}")

# ================================
# 5. TRAIN MODEL
# ================================
model = XGBClassifier(
    n_estimators=100,
    max_depth=6,
    learning_rate=0.1,
    scale_pos_weight=scale_pos_weight,
    use_label_encoder=False,
    eval_metric="logloss"
)

model.fit(X_train, y_train)

# ================================
# 6. EVALUATION
# ================================
y_pred = model.predict(X_test)

print("\n[INFO] Classification Report:")
print(classification_report(y_test, y_pred))

# ================================
# 7. SAVE MODEL
# ================================
joblib.dump(model, MODEL_PATH)

print(f"\n[INFO] Model saved to {MODEL_PATH}")