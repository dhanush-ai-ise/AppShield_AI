"""
Multi-model training & benchmarking script.

Trains every model in MODEL_REGISTRY on the combined fused-feature dataset,
saves each trained model + its metrics to /app/ml/trained_models/, and writes
a benchmark_results.json consumed by the Research Mode / Model Comparison
frontend pages.

Usage:
    python -m app.ml.train_models --data ../../datasets/combined/processed/training_data.csv

Expected CSV columns (see /datasets/combined/README.md):
    permission_risk, review_risk, apk_static_risk, developer_risk,
    certificate_risk, icon_similarity_risk, metadata_risk, label
    (label: 0=Safe, 1=Suspicious, 2=Fraudulent)
"""
import argparse
import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import (
    RandomForestClassifier, ExtraTreesClassifier,
    VotingClassifier, StackingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix,
)
from sklearn.preprocessing import label_binarize

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier

from app.fusion.fusion_engine import FEATURE_ORDER
from app.config import settings

MODEL_ROOT = settings.MODEL_ROOT


def get_base_models():
    return {
        "random_forest": RandomForestClassifier(n_estimators=300, max_depth=12, random_state=42),
        "extra_trees": ExtraTreesClassifier(n_estimators=300, max_depth=12, random_state=42),
        "xgboost": XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.08,
            eval_metric="mlogloss", random_state=42,
        ),
        "lightgbm": LGBMClassifier(n_estimators=300, max_depth=-1, learning_rate=0.08, random_state=42),
        "catboost": CatBoostClassifier(
            iterations=300, depth=6, learning_rate=0.08, verbose=False, random_state=42,
        ),
    }


def evaluate(model, X_test, y_test, n_classes: int) -> dict:
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)
    y_test_bin = label_binarize(y_test, classes=list(range(n_classes)))

    return {
        "accuracy": round(accuracy_score(y_test, y_pred) * 100, 2),
        "precision": round(precision_score(y_test, y_pred, average="weighted", zero_division=0) * 100, 2),
        "recall": round(recall_score(y_test, y_pred, average="weighted", zero_division=0) * 100, 2),
        "f1_score": round(f1_score(y_test, y_pred, average="weighted", zero_division=0) * 100, 2),
        "roc_auc": round(roc_auc_score(y_test_bin, y_proba, multi_class="ovr"), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }


def train_all(data_path: str):
    df = pd.read_csv(data_path)
    X = df[FEATURE_ORDER].values
    y = df["label"].values
    n_classes = len(set(y))

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    base_models = get_base_models()
    results = {}
    fitted = {}

    for name, model in base_models.items():
        t0 = time.time()
        model.fit(X_train, y_train)
        train_time = round(time.time() - t0, 2)

        t0 = time.time()
        metrics = evaluate(model, X_test, y_test, n_classes)
        infer_time = round((time.time() - t0) / max(len(X_test), 1), 4)

        metrics["training_time_s"] = train_time
        metrics["inference_time_s"] = infer_time
        results[name] = metrics
        fitted[name] = model

        joblib.dump(model, MODEL_ROOT / f"{name}.joblib")

    # --- Voting Ensemble ---
    voting = VotingClassifier(
        estimators=[(n, m) for n, m in fitted.items()], voting="soft"
    )
    voting.fit(X_train, y_train)
    v_metrics = evaluate(voting, X_test, y_test, n_classes)
    v_metrics["training_time_s"] = None
    v_metrics["inference_time_s"] = None
    results["voting_ensemble"] = v_metrics
    joblib.dump(voting, MODEL_ROOT / "voting_ensemble.joblib")

    # --- Stacking Ensemble ---
    stacking = StackingClassifier(
        estimators=[(n, m) for n, m in fitted.items()],
        final_estimator=LogisticRegression(max_iter=1000),
        passthrough=False,
    )
    stacking.fit(X_train, y_train)
    s_metrics = evaluate(stacking, X_test, y_test, n_classes)
    s_metrics["training_time_s"] = None
    s_metrics["inference_time_s"] = None
    results["stacking_ensemble"] = s_metrics
    joblib.dump(stacking, MODEL_ROOT / "stacking_ensemble.joblib")

    best_model = max(results, key=lambda k: results[k]["f1_score"])
    (MODEL_ROOT / "best_model.txt").write_text(best_model)

    with open(MODEL_ROOT / "benchmark_results.json", "w") as f:
        json.dump({"results": results, "best_model": best_model, "feature_order": FEATURE_ORDER}, f, indent=2)

    print(f"Training complete. Best model: {best_model}")
    return results, best_model


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(Path(__file__).resolve().parents[3] / "datasets" / "combined" / "processed" / "training_data.csv"))
    args = parser.parse_args()
    train_all(args.data)
