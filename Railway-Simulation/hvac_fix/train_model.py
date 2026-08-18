"""
train_model.py
---------------------------------------------------------------
Trains a Random Forest to predict Remaining Useful Life (RUL) from
the telemetry produced by generateTrainingDataset.js.

Run:
    pip install pandas numpy scikit-learn joblib
    python train_model.py
"""

import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

TARGET_COL = "remaining_useful_life"

RAW_NUMERIC_COLS = [
    "operating_hours", "ambient_temperature", "humidity", "passenger_count",
    "train_speed", "supply_voltage", "supply_air_temperature",
    "refrigerant_pressure", "compressor_current", "filter_dp",
    "cooling_capacity", "power_consumption", "compressor_wear",
    "motor_wear", "refrigerant_charge", "health_score",
]


def load_data(path="training_data/telemetry.csv"):
    df = pd.read_csv(path)
    df = df.sort_values(["asset_id", "operating_hours"]).reset_index(drop=True)
    return df


def engineer_features(df, window=20):
    """Rolling statistics per asset -- trend features usually matter more
    than a single instantaneous reading for RUL prediction."""
    df = df.copy()
    group = df.groupby("asset_id")

    for col in ["supply_air_temperature", "compressor_current", "filter_dp", "power_consumption"]:
        df[f"{col}_roll_mean"] = group[col].transform(lambda s: s.rolling(window, min_periods=1).mean())
        df[f"{col}_roll_std"] = group[col].transform(lambda s: s.rolling(window, min_periods=1).std().fillna(0))
        df[f"{col}_rate"] = group[col].transform(lambda s: s.diff().fillna(0))

    df["health_trend"] = group["health_score"].transform(lambda s: s.diff().fillna(0))
    df["power_efficiency"] = df["power_consumption"] / (df["cooling_capacity"] + 0.1)

    df = pd.get_dummies(df, columns=["asset_state", "health_status"], drop_first=False)
    return df


def train(df):
    df = engineer_features(df)

    engineered_cols = [c for c in df.columns if any(
        c.startswith(p) for p in [
            "supply_air_temperature_", "compressor_current_", "filter_dp_",
            "power_consumption_", "asset_state_", "health_status_"
        ]
    )] + ["health_trend", "power_efficiency"]

    feature_cols = RAW_NUMERIC_COLS + engineered_cols
    feature_cols = [c for c in feature_cols if c in df.columns]

    X = df[feature_cols]
    y = df[TARGET_COL]
    groups = df["asset_id"]

    # Split by UNIT, not by row -- evaluates the model on entirely unseen
    # equipment, which is the correct way to validate an RUL model.
    unique_assets = groups.unique()
    train_assets, test_assets = train_test_split(unique_assets, test_size=0.2, random_state=42)
    train_mask, test_mask = groups.isin(train_assets), groups.isin(test_assets)

    X_train, X_test = X[train_mask], X[test_mask]
    y_train, y_test = y[train_mask], y[test_mask]

    print(f"Training on {len(X_train)} rows from {len(train_assets)} units")
    print(f"Testing on  {len(X_test)} rows from {len(test_assets)} units\n")

    model = RandomForestRegressor(
        n_estimators=150, max_depth=16, min_samples_leaf=5, n_jobs=-1, random_state=42,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)
    print(f"MAE (hours): {mae:.1f}")
    print(f"R^2 score:   {r2:.3f}\n")

    importances = pd.Series(model.feature_importances_, index=feature_cols).sort_values(ascending=False)
    print("Top 10 most important features:")
    print(importances.head(10).to_string())

    joblib.dump({"model": model, "feature_cols": feature_cols}, "rul_model.pkl")
    print("\nModel saved to rul_model.pkl")
    return model, feature_cols, mae, r2


if __name__ == "__main__":
    df = load_data("training_data/telemetry.csv")
    print(f"Loaded {len(df)} rows across {df['asset_id'].nunique()} units\n")
    train(df)
