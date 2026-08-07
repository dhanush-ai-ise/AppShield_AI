"""
Generates a synthetic training_data.csv so the training pipeline is runnable
out of the box for development/demo purposes ONLY.

*** Replace this with real labeled data before production use. ***
See /datasets/combined/README.md for how to build the real fused dataset
from the per-module open-source sources.

Usage: python -m app.ml.seed_synthetic_data
"""
import numpy as np
import pandas as pd
from pathlib import Path

from app.fusion.fusion_engine import FEATURE_ORDER
from app.config import settings

np.random.seed(42)


def generate(n_per_class: int = 500) -> pd.DataFrame:
    rows = []

    # class 0 = Safe: low risk scores across the board
    for _ in range(n_per_class):
        rows.append([*np.clip(np.random.normal(0.15, 0.08, len(FEATURE_ORDER)), 0, 1), 0])

    # class 1 = Suspicious: mid risk, some noisy high features
    for _ in range(n_per_class):
        base = np.clip(np.random.normal(0.45, 0.15, len(FEATURE_ORDER)), 0, 1)
        rows.append([*base, 1])

    # class 2 = Fraudulent: high risk across most features
    for _ in range(n_per_class):
        base = np.clip(np.random.normal(0.78, 0.12, len(FEATURE_ORDER)), 0, 1)
        rows.append([*base, 2])

    df = pd.DataFrame(rows, columns=FEATURE_ORDER + ["label"])
    return df.sample(frac=1, random_state=42).reset_index(drop=True)


if __name__ == "__main__":
    out_dir = settings.DATASET_ROOT / "combined" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)
    df = generate()
    out_path = out_dir / "training_data.csv"
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} synthetic rows to {out_path}")
