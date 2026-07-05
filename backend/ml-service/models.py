"""ML model factory — gradient boosting, random forest, stacking."""
from __future__ import annotations

from sklearn.ensemble import (
    GradientBoostingClassifier,
    HistGradientBoostingClassifier,
    RandomForestClassifier,
    StackingClassifier,
    VotingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def build_model(model_type: str = "gradient_boosting", hyperparams: dict | None = None):
    hp = hyperparams or {}
    mt = (model_type or "gradient_boosting").lower()

    if mt == "random_forest":
        return RandomForestClassifier(
            n_estimators=int(hp.get("n_estimators", 200)),
            max_depth=int(hp.get("max_depth", 8)),
            min_samples_leaf=int(hp.get("min_samples_leaf", 5)),
            random_state=42,
            n_jobs=-1,
        )

    if mt == "hist_gradient_boosting":
        return HistGradientBoostingClassifier(
            max_iter=int(hp.get("n_estimators", 150)),
            max_depth=int(hp.get("max_depth", 6)),
            learning_rate=float(hp.get("learning_rate", 0.08)),
            random_state=42,
        )

    if mt == "stacking":
        estimators = [
            ("gb", GradientBoostingClassifier(n_estimators=80, max_depth=4, random_state=42)),
            ("rf", RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42, n_jobs=-1)),
            ("hgb", HistGradientBoostingClassifier(max_iter=80, max_depth=5, random_state=42)),
        ]
        return StackingClassifier(
            estimators=estimators,
            final_estimator=LogisticRegression(max_iter=500, random_state=42),
            cv=3,
            passthrough=False,
        )

    if mt == "ensemble_vote":
        estimators = [
            ("gb", GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)),
            ("rf", RandomForestClassifier(n_estimators=120, max_depth=6, random_state=42, n_jobs=-1)),
        ]
        return VotingClassifier(estimators=estimators, voting="soft")

    # default: gradient_boosting
    return GradientBoostingClassifier(
        n_estimators=int(hp.get("n_estimators", 120)),
        max_depth=int(hp.get("max_depth", 4)),
        learning_rate=float(hp.get("learning_rate", 0.08)),
        subsample=float(hp.get("subsample", 0.8)),
        random_state=42,
    )


def build_pipeline(model_type: str, hyperparams: dict | None = None) -> Pipeline:
    return Pipeline([
        ("scaler", StandardScaler()),
        ("clf", build_model(model_type, hyperparams)),
    ])
