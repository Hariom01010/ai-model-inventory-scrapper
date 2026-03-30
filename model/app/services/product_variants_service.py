import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
from collections import defaultdict

def extract_features(item):
    return [
        item.x,
        item.y,
        item.width,
        item.height,
        item.siblingCount,
        item.childCount,
        1 if item.hasImage else 0,
        1 if item.isClickable else 0
    ]

def cluster_variant_elements(items):
    feature_list = [extract_features(item) for item in items]
    x = np.array(feature_list)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(x)

    db = DBSCAN(eps=0.5, min_samples=2)
    labels = db.fit_predict(X_scaled)

    clusters = defaultdict(list)

    for item, label in zip(items, labels):
        if label == -1:
            continue  # skip noise (optional)
        clusters[label].append(item)

    return list(clusters.values())
