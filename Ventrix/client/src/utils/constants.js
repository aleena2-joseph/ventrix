export const APP_NAME = "VENTRIX";
export const APP_TAGLINE = "AI-POWERED RAILWAY HVAC PLATFORM";
export const APP_SUBTITLE = "HVAC Useful Life Prediction";
export const NAV_LINKS = [
  { name: "Overview", href: "#overview" },
  { name: "Access Platform", href: "#access" },
  { name: "Features", href: "#features" },
  { name: "Dashboard Preview", href: "/dashboard" },
];
export const FEATURES = [
  {
    id: "monitoring",
    title: "REAL-TIME MONITORING",
    description: "Live telemetry tracking across all train car HVAC units, compressors, and airflow metrics.",
    icon: "Activity",
  },
  {
    id: "predictions",
    title: "AI PREDICTIONS",
    description: "Machine learning RUL (Remaining Useful Life) estimates with anomaly detection.",
    icon: "TrendingUp",
  },
   {
    id: "health",
    title: "ASSET HEALTH",
    description: "Comprehensive health indexes and degradation diagnostics for proactive upkeep.",
    icon: "ShieldCheck",
  },
  {
    id: "maintenance",
    title: "SMART MAINTENANCE",
    description: "Automated work orders and predictive maintenance scheduling to eliminate downtime.",
    icon: "Settings",
  },
];
export const DEMO_TRAIN_UNITS = [
  { id: "HVAC-101", car: "Coach A1", status: "Optimal", health: 94, temp: "21.5°C", vibration: "0.12 g", rul: "1,420 hrs" },
  { id: "HVAC-102", car: "Coach B3", status: "Warning", health: 71, temp: "24.8°C", vibration: "0.38 g", rul: "340 hrs" },
  { id: "HVAC-103", car: "Locomotive 1", status: "Optimal", health: 98, temp: "20.1°C", vibration: "0.09 g", rul: "2,100 hrs" },
  { id: "HVAC-104", car: "Coach C2", status: "Critical", health: 48, temp: "27.3°C", vibration: "0.62 g", rul: "85 hrs" },
];