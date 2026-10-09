"""
predict.py
---------------------------------------------------------------
Loads the trained Random Forest model (rul_model.pkl) and performs
Remaining Useful Life (RUL) inference on new HVAC telemetry.

Usage:
    python predict.py                  # Runs sample demo predictions (Nominal vs Degraded)
    python predict.py --csv <path>     # Predicts RUL for rows in a telemetry CSV
"""

import sys
import os
import argparse
import joblib
import pandas as pd
import numpy as np

# Ensure UTF-8 output on Windows terminals
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

MODEL_FILE = os.path.join(os.path.dirname(__file__), "rul_model.pkl")

# Raw numeric features expected from telemetry
RAW_NUMERIC_COLS = [
    "operating_hours", "ambient_temperature", "humidity", "passenger_count",
    "train_speed", "supply_voltage", "supply_air_temperature",
    "refrigerant_pressure", "compressor_current", "filter_dp",
    "cooling_capacity", "power_consumption", "compressor_wear",
    "motor_wear", "refrigerant_charge", "health_score",
]


def load_model(model_path=MODEL_FILE):
    """Loads the trained Random Forest model artifact."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model file '{model_path}' not found! Run 'python train_model.py' first."
        )
    artifact = joblib.load(model_path)
    return artifact["model"], artifact["feature_cols"]


def engineer_inference_features(df, window=20):
    """
    Applies the exact same feature engineering used during training:
    - 20-cycle rolling statistics (mean, std, rate of change)
    - Power efficiency ratio
    - Health trend
    - One-hot encoding of asset_state and health_status
    """
    df = df.copy()
    if "asset_id" not in df.columns:
        df["asset_id"] = "HVAC-UNKNOWN"

    group = df.groupby("asset_id")

    for col in ["supply_air_temperature", "compressor_current", "filter_dp", "power_consumption"]:
        if col in df.columns:
            df[f"{col}_roll_mean"] = group[col].transform(lambda s: s.rolling(window, min_periods=1).mean())
            df[f"{col}_roll_std"] = group[col].transform(lambda s: s.rolling(window, min_periods=1).std().fillna(0))
            df[f"{col}_rate"] = group[col].transform(lambda s: s.diff().fillna(0))
        else:
            df[f"{col}_roll_mean"] = 0.0
            df[f"{col}_roll_std"] = 0.0
            df[f"{col}_rate"] = 0.0

    if "health_score" in df.columns:
        df["health_trend"] = group["health_score"].transform(lambda s: s.diff().fillna(0))
    else:
        df["health_trend"] = 0.0

    if "power_consumption" in df.columns and "cooling_capacity" in df.columns:
        df["power_efficiency"] = df["power_consumption"] / (df["cooling_capacity"] + 0.1)
    else:
        df["power_efficiency"] = 1.0

    cat_cols = [c for c in ["asset_state", "health_status"] if c in df.columns]
    if cat_cols:
        df = pd.get_dummies(df, columns=cat_cols, drop_first=False)

    return df


def predict_rul(df_telemetry, model=None, feature_cols=None):
    """
    Predicts Remaining Useful Life (RUL) in hours for input telemetry.
    Returns the DataFrame with an added 'predicted_rul' column.
    """
    if model is None or feature_cols is None:
        model, feature_cols = load_model()

    engineered_df = engineer_inference_features(df_telemetry)

    # Ensure all trained feature columns are present (fill missing dummy columns with 0)
    for col in feature_cols:
        if col not in engineered_df.columns:
            engineered_df[col] = 0.0

    X = engineered_df[feature_cols]
    predictions = model.predict(X)
    
    result = df_telemetry.copy()
    result["predicted_rul"] = np.round(np.maximum(0, predictions), 1)
    return result


def demo_sample_inference():
    """Demonstrates live inference on sample nominal and degraded HVAC operating states."""
    print("=" * 65)
    print(" 🚂 Ventrix AI Predictive Engine — RUL Model Inference Demo")
    print("=" * 65)
    print(f"Loading trained Random Forest model: {MODEL_FILE}")
    model, feature_cols = load_model()
    print(f"✅ Model loaded successfully ({len(feature_cols)} input features).\n")

    # Sample A: Healthy HVAC unit (Nominal, 1,200 operating hours)
    # Sample B: Clogged filter and worn compressor (Warning, 14,800 operating hours)
    sample_records = [
        {
            "asset_id": "HVAC-001",
            "asset_state": "NOMINAL",
            "health_status": "GOOD",
            "operating_hours": 1200.0,
            "ambient_temperature": 32.0,
            "humidity": 55.0,
            "passenger_count": 48,
            "train_speed": 75.0,
            "supply_voltage": 415.0,
            "supply_air_temperature": 21.2,
            "refrigerant_pressure": 4.85,
            "compressor_current": 13.9,
            "filter_dp": 165.0,
            "cooling_capacity": 42.0,
            "power_consumption": 8.4,
            "compressor_wear": 0.06,
            "motor_wear": 0.05,
            "refrigerant_charge": 1.0,
            "health_score": 94.0,
        },
        {
            "asset_id": "HVAC-005",
            "asset_state": "WARNING",
            "health_status": "WARNING",
            "operating_hours": 14850.0,
            "ambient_temperature": 36.5,
            "humidity": 68.0,
            "passenger_count": 85,
            "train_speed": 60.0,
            "supply_voltage": 405.0,
            "supply_air_temperature": 26.4,
            "refrigerant_pressure": 3.75,
            "compressor_current": 17.8,
            "filter_dp": 310.0,
            "cooling_capacity": 28.5,
            "power_consumption": 11.2,
            "compressor_wear": 0.62,
            "motor_wear": 0.58,
            "refrigerant_charge": 0.82,
            "health_score": 61.5,
        },
    ]

    df_sample = pd.DataFrame(sample_records)
    predictions_df = predict_rul(df_sample, model, feature_cols)

    for idx, row in predictions_df.iterrows():
        rul = row["predicted_rul"]
        status = "🔴 CRITICAL / ACTION REQUIRED" if rul < 150 else ("🟡 HIGH WEAR" if rul < 500 else ("🔵 MEDIUM" if rul < 1000 else "🟢 NOMINAL / HEALTHY"))
        print(f"Asset ID:           {row['asset_id']}")
        print(f"  Operating State:  {row['asset_state']} (Health: {row['health_score']}%)")
        print(f"  Filter DP:        {row['filter_dp']} Pa | Compressor Current: {row['compressor_current']} A")
        print(f"  Operating Hours:  {row['operating_hours']} hrs")
        print(f"  -> Predicted RUL: {rul:.1f} hours ({rul / 24:.1f} operational days)")
        print(f"  -> Status:        {status}\n")

    print("=" * 65)
    print("✅ Inference complete. Model successfully evaluated.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predict HVAC Remaining Useful Life (RUL)")
    parser.add_argument("--csv", type=str, help="Path to telemetry CSV file for batch RUL prediction")
    parser.add_argument("--json", type=str, help="Path to JSON file or raw JSON string of telemetry records")
    parser.add_argument("--stdin", action="store_true", help="Read JSON telemetry records from stdin")
    args = parser.parse_args()

    if args.stdin or args.json:
        import json
        if args.stdin:
            raw_json = sys.stdin.read().strip()
            data = json.loads(raw_json)
        else:
            raw_json = args.json.strip()
            if os.path.exists(raw_json):
                with open(raw_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
            else:
                data = json.loads(raw_json)

        if isinstance(data, dict):
            records = [data]
        elif isinstance(data, list):
            records = data
        else:
            records = []

        df_input = pd.DataFrame(records)
        if df_input.empty:
            print(json.dumps({"success": False, "error": "No records provided"}))
            sys.exit(0)

        model, feature_cols = load_model()
        preds_df = predict_rul(df_input, model, feature_cols)

        results = []
        for _, row in preds_df.iterrows():
            rul = float(row.get("predicted_rul", 0.0))
            health = float(row.get("health_score", 100.0)) if pd.notnull(row.get("health_score")) else 100.0
            
            # Primary AI Risk Classification based strictly on RUL (hours)
            # CRITICAL: < 150h (Immediate inspection required)
            # HIGH:     150h–500h (Maintenance within 72h)
            # MEDIUM:   500h–1000h (Increased monitoring)
            # NOMINAL:  >= 1000h (Normal operation)
            if rul < 150:
                risk = "CRITICAL"
            elif rul < 500:
                risk = "HIGH"
            elif rul < 1000:
                risk = "MEDIUM"
            else:
                risk = "NOMINAL"

            # Separate Condition Indicator based on Health Score (0–100%)
            # Healthy:              >= 90%
            # Good:                 75–89.9%
            # Warning:              60–74.9%
            # Maintenance Required: 40–59.9%
            # Critical:             < 40%
            if health >= 90:
                health_cond = "Healthy"
            elif health >= 75:
                health_cond = "Good"
            elif health >= 60:
                health_cond = "Warning"
            elif health >= 40:
                health_cond = "Maintenance Required"
            else:
                health_cond = "Critical"

            results.append({
                "asset_id": str(row.get("asset_id", "UNKNOWN")),
                "predicted_rul": round(rul, 1),
                "predicted_days": round(rul / 24.0, 1),
                "risk_level": risk,
                "health_score": round(health, 1),
                "health_condition": health_cond,
                "operating_hours": float(row.get("operating_hours", 0.0)),
                "filter_dp": float(row.get("filter_dp", 0.0)),
                "compressor_current": float(row.get("compressor_current", 0.0)),
                "supply_air_temperature": float(row.get("supply_air_temperature", 0.0)),
                "refrigerant_pressure": float(row.get("refrigerant_pressure", 0.0)),
                "model_version": "random-forest-v1",
                "prediction_source": "AI_MODEL",
            })

        print(json.dumps({"success": True, "count": len(results), "predictions": results}))
    elif args.csv:
        print(f"Reading input telemetry from {args.csv}...")
        df = pd.read_csv(args.csv)
        preds = predict_rul(df)
        out_csv = "predicted_rul_output.csv"
        preds.to_csv(out_csv, index=False)
        print(f"Predictions saved to {out_csv}")
    else:
        demo_sample_inference()

