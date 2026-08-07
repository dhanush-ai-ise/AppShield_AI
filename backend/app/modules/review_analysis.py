"""
Module 2: Review Analysis (Fake/Spam review + Sentiment).

Primary path:
- DistilBERT sentiment enrichment when transformers is available.

Classifier path:
- A learned TF-IDF + LogisticRegression fake-review model trained from the
  local review dataset, with heuristic fallback when no dataset is available.
"""
from collections import Counter
from functools import lru_cache
from pathlib import Path
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from app.config import settings

GENERIC_SPAM_PHRASES = [
    "best app ever",
    "very nice app",
    "good app",
    "nice",
    "excellent app",
    "five star",
    "amazing app must download",
    "works great",
]


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def _find_column(columns: List[str], candidates: List[str]) -> Optional[str]:
    lowered = {col.lower(): col for col in columns}
    for candidate in candidates:
        if candidate in lowered:
            return lowered[candidate]
    return None


def _is_fake_label(value) -> bool:
    if value is None:
        return False
    normalized = str(value).strip().lower()
    return normalized in {"cg", "fake", "deceptive", "spam", "1", "fraudulent"}


@lru_cache(maxsize=1)
def _load_distilbert_sentiment():
    try:
        from transformers import pipeline

        return pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
        )
    except Exception:
        return None


@lru_cache(maxsize=1)
def _load_fake_review_model() -> Optional[Pipeline]:
    review_dir = settings.DATASET_ROOT / "reviews" / "raw"
    csv_paths = [path for path in review_dir.glob("*.csv") if path.is_file()]
    training_texts: List[str] = []
    training_labels: List[int] = []

    for path in csv_paths:
        try:
            df = pd.read_csv(path)
        except Exception:
            continue

        text_col = _find_column(list(df.columns), ["text_", "text", "review_text", "content", "review"])
        label_col = _find_column(list(df.columns), ["label", "class", "is_fake"])
        if not text_col or not label_col:
            continue

        sample = df[[text_col, label_col]].dropna().head(20000)
        for _, row in sample.iterrows():
            text = _normalize(str(row[text_col]))
            if len(text) < 3:
                continue
            training_texts.append(text)
            training_labels.append(1 if _is_fake_label(row[label_col]) else 0)

    if len(training_texts) < 100 or len(set(training_labels)) < 2:
        return None

    model = Pipeline(
        steps=[
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=20000)),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
        ]
    )
    model.fit(training_texts, training_labels)
    return model


def _score_reviews_with_model(texts: List[str]) -> Optional[List[float]]:
    model = _load_fake_review_model()
    if model is None:
        return None

    probabilities = model.predict_proba(texts)
    return [float(row[1]) for row in probabilities]


def _heuristic_fake_scores(texts: List[str]) -> List[float]:
    counts = Counter(texts)
    duplicate_score_map = {
        text: min(1.0, 0.35 + 0.15 * (count - 1)) if count > 1 else 0.0
        for text, count in counts.items()
    }
    scores = []
    for text in texts:
        generic_score = 0.45 if any(phrase in text for phrase in GENERIC_SPAM_PHRASES) else 0.0
        scores.append(min(1.0, duplicate_score_map[text] + generic_score))
    return scores


def _sentiment_summary(texts: List[str]) -> Tuple[Optional[float], Optional[str]]:
    sentiment_pipeline = _load_distilbert_sentiment()
    if sentiment_pipeline is None or not texts:
        return None, None

    try:
        sample = [text[:512] for text in texts[:32]]
        results = sentiment_pipeline(sample)
        positive_ratio = sum(1 for item in results if item["label"].upper() == "POSITIVE") / len(results)
        label = "positive" if positive_ratio >= 0.5 else "negative"
        return round(float(positive_ratio), 4), label
    except Exception:
        return None, None


def analyze_reviews(reviews: List[Dict]) -> Dict:
    """
    reviews: list of {"text": str, "rating": int, "date": str, "author": str}
    """
    if not reviews:
        return {
            "module": "review_analysis",
            "score": 0.3,
            "fake_review_ratio": None,
            "reasons": ["No reviews available to analyze — defaulting to moderate uncertainty score."],
        }

    texts = [_normalize(r.get("text", "")) for r in reviews if _normalize(r.get("text", ""))]
    if not texts:
        return {
            "module": "review_analysis",
            "score": 0.3,
            "fake_review_ratio": None,
            "reasons": ["Reviews were present but contained no usable text."],
        }

    duplicate_ratio = 1 - (len(set(texts)) / len(texts))
    ratings = [r.get("rating", 3) for r in reviews]
    five_star_ratio = sum(1 for rating in ratings if rating == 5) / max(len(ratings), 1)
    burst_penalty = 0.2 if five_star_ratio > 0.9 else 0.0

    model_scores = _score_reviews_with_model(texts)
    fake_scores = model_scores if model_scores is not None else _heuristic_fake_scores(texts)

    fake_ratio = sum(1 for score in fake_scores if score >= 0.6) / len(fake_scores)
    average_fake_score = sum(fake_scores) / len(fake_scores)
    sentiment_ratio, sentiment_label = _sentiment_summary(texts)

    score = min(
        1.0,
        average_fake_score * 0.75 + duplicate_ratio * 0.15 + burst_penalty,
    )

    reasons = [
        f"{round(fake_ratio * 100)}% of reviews were classified as likely fake or spam."
    ]
    if model_scores is not None:
        reasons.append("The fake-review score was generated by a classifier trained from the local review dataset.")
    else:
        reasons.append("A heuristic fallback was used because no trained fake-review model was available.")
    if burst_penalty:
        reasons.append("Unnatural rating burst detected (majority 5-star reviews).")
    if sentiment_ratio is not None and sentiment_label is not None:
        reasons.append(
            f"DistilBERT sentiment sampling found the review set to be mostly {sentiment_label} "
            f"({round(sentiment_ratio * 100)}% positive)."
        )

    return {
        "module": "review_analysis",
        "score": round(score, 4),
        "fake_review_ratio": round(fake_ratio, 4),
        "reviews_analyzed": len(texts),
        "average_fake_score": round(float(average_fake_score), 4),
        "reasons": reasons,
    }
