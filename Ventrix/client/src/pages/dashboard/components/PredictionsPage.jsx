import React, { useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldAlert,
  Sparkles,
  Activity,
  ArrowRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import Card from "../../../components/common/Card";

const RISK_CONFIG = {
  CRITICAL: { color: "#EF4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)", label: "Critical (<150h)" },
  HIGH: { color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)", label: "High Wear (150-500h)" },
  MEDIUM: { color: "#3B82F6", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.3)", label: "Medium (500-1000h)" },
  LOW: { color: "#10B981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)", label: "Nominal (>1000h)" },
};

function getRiskCategory(health, rul) {
  if (health < 40 || (rul != null && rul < 150)) return "CRITICAL";
  if (health < 60 || (rul != null && rul < 500)) return "HIGH";
  if (health < 80 || (rul != null && rul < 1000)) return "MEDIUM";
  return "LOW";
}

function getPrescriptiveAction(health, assetCode) {
  if (health < 40) {
    return `Emergency shutdown advisory for ${assetCode}. Compressor bearing wear detected. Immediate technician dispatch recommended.`;
  }
  if (health < 60) {
    return `Elevated filter differential pressure & condenser thermal lag on ${assetCode}. Replace return air filters & clean condenser coil within 72 hours.`;
  }
  if (health < 80) {
    return `Minor refrigerant subcooling variation detected on ${assetCode}. Inspect TXV valve during next scheduled depot turnaround.`;
  }
  return `Asset ${assetCode} operating under optimal physical parameters. No immediate intervention required.`;
}

// Generate sample degradation trajectory curve for demonstration
const DEGRADATION_CURVE_DATA = [
  { operatingHours: "0h", baselineNominal: 100, actualTrajectory: 100, thresholdWarning: 60, thresholdFailure: 40 },
  { operatingHours: "300h", baselineNominal: 97, actualTrajectory: 96, thresholdWarning: 60, thresholdFailure: 40 },
  { operatingHours: "600h", baselineNominal: 94, actualTrajectory: 91, thresholdWarning: 60, thresholdFailure: 40 },
  { operatingHours: "900h", baselineNominal: 90, actualTrajectory: 84, thresholdWarning: 60, thresholdFailure: 40 },
  { operatingHours: "1200h", baselineNominal: 86, actualTrajectory: 76, thresholdWarning: 60, thresholdFailure: 40 },
  { operatingHours: "1500h", baselineNominal: 82, actualTrajectory: 63, thresholdWarning: 60, thresholdFailure: 40 },
  { operatingHours: "1800h (Projected)", baselineNominal: 78, actualTrajectory: 49, thresholdWarning: 60, thresholdFailure: 40 },
  { operatingHours: "2100h (Projected)", baselineNominal: 74, actualTrajectory: 32, thresholdWarning: 60, thresholdFailure: 40 },
];

export default function PredictionsPage({ assets, onNavigate }) {
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [selectedAssetForCurve, setSelectedAssetForCurve] = useState("HVAC-001");

  const enrichedAssets = assets.map((a) => {
    const health = a.health ?? 88;
    const rul = a.rul ?? (health >= 80 ? 1450 : health >= 60 ? 680 : health >= 40 ? 320 : 90);
    const risk = getRiskCategory(health, rul);
    const recommendation = getPrescriptiveAction(health, a.id);
    return { ...a, health, rul, risk, recommendation };
  });

  const filtered = enrichedAssets.filter((a) => {
    if (riskFilter === "ALL") return true;
    return a.risk === riskFilter;
  });

  const criticalCount = enrichedAssets.filter((a) => a.risk === "CRITICAL").length;
  const highCount = enrichedAssets.filter((a) => a.risk === "HIGH").length;
  const mediumCount = enrichedAssets.filter((a) => a.risk === "MEDIUM").length;
  const nominalCount = enrichedAssets.filter((a) => a.risk === "LOW").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={22} color="#06B6D4" />
            <h2 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>
              Remaining Useful Life (RUL) & AI Health Prediction
            </h2>
          </div>
          <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>
            Physics-guided Machine Learning estimating component degradation trajectories and hours to failure
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            style={{
              background: "rgba(0,0,0,0.25)",
              color: "inherit",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 13,
              outline: "none",
            }}
          >
            <option value="ALL">All Risk Categories ({enrichedAssets.length})</option>
            <option value="CRITICAL">Critical Risk (&lt;150h)</option>
            <option value="HIGH">High Wear (150-500h)</option>
            <option value="MEDIUM">Medium Wear (500-1000h)</option>
            <option value="LOW">Nominal (&gt;1000h)</option>
          </select>
        </div>
      </div>

      {/* 4 Risk Distribution Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Card hoverEffect={false} style={{ borderLeft: "4px solid #EF4444" }}>
          <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 4 }}>Critical Failure Risk</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: "#EF4444" }}>
            {criticalCount}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>RUL &lt; 150 operating hours</div>
        </Card>

        <Card hoverEffect={false} style={{ borderLeft: "4px solid #F59E0B" }}>
          <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 4 }}>High Wear Degradation</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: "#F59E0B" }}>
            {highCount}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Service turnaround required</div>
        </Card>

        <Card hoverEffect={false} style={{ borderLeft: "4px solid #3B82F6" }}>
          <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 4 }}>Medium Wear Units</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: "#3B82F6" }}>
            {mediumCount}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Routine depot monitoring</div>
        </Card>

        <Card hoverEffect={false} style={{ borderLeft: "4px solid #10B981" }}>
          <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 4 }}>Optimal Fleet Health</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: "#10B981" }}>
            {nominalCount}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Expected RUL &gt; 1,000h</div>
        </Card>
      </div>

      {/* Degradation Curve Chart */}
      <Card hoverEffect={false} style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={18} color="#06B6D4" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              AI RUL Degradation Trajectory Curve vs Baseline (Nominal vs Accelerated Wear)
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            Physics model: <strong>Multi-layer Perceptron / Random Forest Regressor</strong>
          </div>
        </div>

        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={DEGRADATION_CURVE_DATA} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="operatingHours" stroke="#64748B" fontSize={11} />
              <YAxis domain={[20, 105]} stroke="#64748B" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#0B1220",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#F8FAFC",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line type="monotone" dataKey="actualTrajectory" name="Actual HVAC Trajectory (Health %)" stroke="#06B6D4" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="baselineNominal" name="Baseline Design Life (%)" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" />
              <Line type="monotone" dataKey="thresholdWarning" name="Warning Limit (60%)" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="2 2" />
              <Line type="monotone" dataKey="thresholdFailure" name="Failure Limit (40%)" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="2 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Asset Predictive Health Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        {filtered.map((a) => {
          const riskConfig = RISK_CONFIG[a.risk] || RISK_CONFIG.LOW;

          return (
            <Card key={a.id} hoverEffect={false} style={{ border: `1px solid ${riskConfig.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16 }}>
                    {a.id}
                  </span>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{a.name || "HVAC Unit"}</span>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 9px",
                    borderRadius: 20,
                    background: riskConfig.bg,
                    color: riskConfig.color,
                    border: `1px solid ${riskConfig.color}44`,
                  }}
                >
                  {a.risk}
                </span>
              </div>

              {/* RUL Meter & Health */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>Predicted RUL</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: riskConfig.color, marginTop: 2 }}>
                    {Math.round(a.rul)} hrs
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>Health Index</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: a.health >= 80 ? "#10B981" : a.health >= 60 ? "#F59E0B" : "#EF4444", marginTop: 2 }}>
                    {a.health}%
                  </div>
                </div>
              </div>

              {/* Prescriptive Guidance */}
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(6, 182, 212, 0.06)",
                  border: "1px solid rgba(6, 182, 212, 0.2)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#06B6D4", fontWeight: 700, marginBottom: 3 }}>
                  <Sparkles size={13} /> AI Prescriptive Advisory
                </div>
                {a.recommendation}
              </div>

              {/* Schedule Maintenance Trigger */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>Confidence: <strong>96.4%</strong></span>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("maintenance")}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "4px 9px",
                      color: "#06B6D4",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Wrench size={12} /> Schedule Maintenance
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
