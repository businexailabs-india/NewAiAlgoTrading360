"""Advanced training and inference with walk-forward validation."""
from __future__ import annotations

import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit

from features import build_dataset, build_features, bars_to_frame
from models import build_pipeline

MODEL_DIR = Path(os.environ.get("ML_MODEL_DIR", "/app/models"))
MODEL_DIR.mkdir(parents=True, exist_ok=True)

HYPERPARAM_GRIDS: dict[str, dict] = {
    "gradient_boosting": {
        "clf__n_estimators": [80, 120, 160],
        "clf__max_depth": [3, 4, 5],
        "clf__learning_rate": [0.05, 0.08, 0.12],
    },
    "random_forest": {
        "clf__n_estimators": [100, 200],
        "clf__max_depth": [6, 8, 10],
    },
    "hist_gradient_boosting": {
        "clf__max_iter": [100, 150, 200],
        "clf__max_depth": [4, 6, 8],
    },
}


def model_path(engine_id: str, symbol: str) -> Path:
    safe = symbol.replace("/", "_")
    return MODEL_DIR / f"{engine_id}_{safe}.joblib"


def walk_forward_evaluate(
    X: pd.DataFrame,
    y: pd.Series,
    model_type: str,
    n_splits: int = 5,
    tune_hyperparams: bool = False,
) -> dict:
    tscv = TimeSeriesSplit(n_splits=min(n_splits, max(2, len(X) // 100)))
    fold_accs: list[float] = []
    fold_f1s: list[float] = []

    for train_idx, test_idx in tscv.split(X):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
        if len(X_test) < 10:
            continue

        pipe = build_pipeline(model_type)
        if tune_hyperparams and model_type in HYPERPARAM_GRIDS and len(X_train) > 120:
            search = RandomizedSearchCV(
                pipe,
                HYPERPARAM_GRIDS[model_type],
                n_iter=6,
                cv=TimeSeriesSplit(n_splits=3),
                scoring="accuracy",
                random_state=42,
                n_jobs=-1,
            )
            search.fit(X_train, y_train)
            pipe = search.best_estimator_
        else:
            pipe.fit(X_train, y_train)

        pred = pipe.predict(X_test)
        fold_accs.append(float(accuracy_score(y_test, pred) * 100))
        fold_f1s.append(float(f1_score(y_test, pred, average="weighted", zero_division=0) * 100))

    if not fold_accs:
        return {"walk_forward_accuracy": 0.0, "walk_forward_f1": 0.0, "folds": 0}

    return {
        "walk_forward_accuracy": round(float(np.mean(fold_accs)), 2),
        "walk_forward_f1": round(float(np.mean(fold_f1s)), 2),
        "fold_accuracy_std": round(float(np.std(fold_accs)), 2),
        "folds": len(fold_accs),
    }


def train_symbol(
    engine_id: str,
    symbol: str,
    bars: list[dict],
    horizon_days: int = 7,
    test_ratio: float = 0.2,
    model_type: str = "gradient_boosting",
    validation_mode: str = "walk_forward",
    tune_hyperparams: bool = False,
) -> dict:
    X, y = build_dataset(bars, horizon_days)
    if len(X) < 80:
        raise ValueError(f"Insufficient data for {symbol}: {len(X)} samples")

    split_idx = int(len(X) * (1 - test_ratio))
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

    pipe = build_pipeline(model_type)
    best_params: dict = {}

    if tune_hyperparams and model_type in HYPERPARAM_GRIDS and len(X_train) > 150:
        search = RandomizedSearchCV(
            pipe,
            HYPERPARAM_GRIDS[model_type],
            n_iter=8,
            cv=TimeSeriesSplit(n_splits=3),
            scoring="accuracy",
            random_state=42,
            n_jobs=-1,
        )
        search.fit(X_train, y_train)
        pipe = search.best_estimator_
        best_params = {k: v for k, v in search.best_params_.items() if not k.startswith("clf__") or True}
        best_params = dict(search.best_params_)
    else:
        pipe.fit(X_train, y_train)

    train_pred = pipe.predict(X_train)
    test_pred = pipe.predict(X_test)
    train_acc = float(accuracy_score(y_train, train_pred) * 100)
    test_acc = float(accuracy_score(y_test, test_pred) * 100)
    test_f1 = float(f1_score(y_test, test_pred, average="weighted", zero_division=0) * 100)

    wf_metrics = (
        walk_forward_evaluate(X, y, model_type, tune_hyperparams=False)
        if validation_mode == "walk_forward"
        else {}
    )

    clf = pipe.named_steps["clf"]
    importances = getattr(clf, "feature_importances_", None)
    if importances is None and hasattr(clf, "final_estimator_"):
        importances = getattr(clf.final_estimator_, "coef_", None)
    feat_imp = (
        dict(zip(X.columns, importances.tolist()))
        if importances is not None and len(importances) == len(X.columns)
        else {}
    )

    payload = {
        "model": pipe,
        "feature_columns": list(X.columns),
        "horizon_days": horizon_days,
        "symbol": symbol,
        "engine_id": engine_id,
        "model_type": model_type,
        "train_accuracy": train_acc,
        "test_accuracy": test_acc,
        "test_f1": test_f1,
        "validation_mode": validation_mode,
        "walk_forward": wf_metrics,
        "best_params": best_params,
    }
    joblib.dump(payload, model_path(engine_id, symbol))

    effective_acc = wf_metrics.get("walk_forward_accuracy", test_acc) if wf_metrics else test_acc

    return {
        "symbol": symbol,
        "train_accuracy": round(train_acc, 2),
        "test_accuracy": round(test_acc, 2),
        "test_f1": round(test_f1, 2),
        "effective_accuracy": round(effective_acc, 2),
        "samples": len(X),
        "feature_importance": feat_imp,
        "model_key": f"{engine_id}_{symbol}",
        "model_type": model_type,
        "validation_mode": validation_mode,
        "walk_forward": wf_metrics,
        "best_params": best_params,
    }


def predict_symbol(
    engine_id: str,
    symbol: str,
    bars: list[dict],
    current_price: float,
    horizon_days: int = 7,
    min_accuracy: float = 50.0,
    rag_context: str | None = None,
) -> dict:
    path = model_path(engine_id, symbol)
    if not path.exists():
        raise ValueError(f"No model for {symbol}. Train first.")

    payload = joblib.load(path)
    pipe = payload["model"]
    cols = payload["feature_columns"]
    test_acc = float(payload.get("test_accuracy", 50))
    wf = payload.get("walk_forward") or {}
    effective_acc = float(wf.get("walk_forward_accuracy", test_acc))

    df = bars_to_frame(bars)
    features = build_features(df)
    if features.empty:
        return _hold(current_price, horizon_days, effective_acc, "insufficient_features")

    row = features.iloc[[-1]][cols]
    proba = pipe.predict_proba(row)[0]
    classes = list(pipe.named_steps["clf"].classes_)
    buy_idx = classes.index(1) if 1 in classes else 1
    sell_idx = classes.index(0) if 0 in classes else 0

    confidence_buy = float(proba[buy_idx] * 100)
    confidence_sell = float(proba[sell_idx] * 100)
    pred = int(pipe.predict(row)[0])

    direction = "BUY" if pred == 1 else "SELL"
    confidence = confidence_buy if pred == 1 else confidence_sell

    # RAG context nudge: bullish/bearish keywords adjust confidence slightly
    if rag_context:
        ctx = rag_context.lower()
        bullish = sum(1 for w in ("bullish", "upgrade", "outperform", "buy", "growth") if w in ctx)
        bearish = sum(1 for w in ("bearish", "downgrade", "underperform", "sell", "risk") if w in ctx)
        nudge = (bullish - bearish) * 2
        if pred == 1:
            confidence = min(95, max(35, confidence + nudge))
        else:
            confidence = min(95, max(35, confidence - nudge))

    if effective_acc < min_accuracy:
        direction = "HOLD"
        confidence = min(confidence, 55.0)

    margin = (confidence_buy - confidence_sell) / 100
    target_price = round(current_price * (1 + margin * horizon_days * 0.01), 2)

    clf = pipe.named_steps["clf"]
    importances = getattr(clf, "feature_importances_", None)
    top_signals = {}
    if importances is not None and len(importances) == len(cols):
        top_signals = dict(sorted(zip(cols, importances), key=lambda x: x[1], reverse=True)[:5])

    return {
        "direction": direction,
        "confidence": round(min(95.0, max(35.0, confidence)), 1),
        "target_price": target_price,
        "current_price": current_price,
        "horizon_days": horizon_days,
        "test_accuracy": round(effective_acc, 1),
        "signals": top_signals,
        "probabilities": {"buy": round(confidence_buy, 1), "sell": round(confidence_sell, 1)},
        "model_type": payload.get("model_type", "gradient_boosting"),
        "rag_adjusted": bool(rag_context),
    }


def _hold(price: float, horizon: int, acc: float, reason: str) -> dict:
    return {
        "direction": "HOLD",
        "confidence": 0.0,
        "target_price": price,
        "current_price": price,
        "horizon_days": horizon,
        "test_accuracy": acc,
        "signals": {"reason": reason},
        "probabilities": {"buy": 50.0, "sell": 50.0},
    }
