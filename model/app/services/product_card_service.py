import joblib
import numpy as np

model = joblib.load("app/models/product_card_model.pkl")

TAG_MAP = {
    "div": 0,
    "li": 1,
    "article": 2,
    "a": 3
}

def extract_features(item):
    return [
        TAG_MAP.get(item.tag, -1),

        item.textLength,

        1 if item.hasImage else 0,
        item.imageCount,

        1 if item.hasLink else 0,
        item.linkCount,

        item.childCount,
        item.siblingCount,

        item.width,
        item.height,
        item.area,

        item.x,
        item.y,

        1 if item.isClickable else 0,
    ]

def predict_product_cards(items):
    feature_list = [extract_features(item) for item in items]
    X = np.array(feature_list)

    preds = model.predict(X)
    probs = model.predict_proba(X)[:, 1]

    results = []
    for i, item in enumerate(items):
        results.append({
            "id": item.id,
            "tag": item.tag,
            "text": item.text[:50] if item.text else "",
            "siblingCount": item.siblingCount,
            "prediction": int(preds[i]),
            "confidence": float(probs[i])
        })

    return results