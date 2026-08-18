import React, { useState, useEffect } from "react";
import {
  Activity,
  Thermometer,
  Gauge,
  Zap,
  Droplets,
  BatteryCharging,
  Clock,
  Waves,
  RotateCw,
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
import { getTelemetryHistory } from "../../../services/telemetryService";
import { getAssets } from "../../../services/assetService";

export default function TelemetryPage({ telemetry: liveTelemetry }) {
  const [assets, setAssets] = useState([]);
  const [selectedAssetCode, setSelectedAssetCode] = useState("");
  const [history, setHistory] = useState([]);
  const [chartMetric, setChartMetric] = useState("temp_pressure");
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    getAssets()
      .then((res) => {
        if (res.success && res.data?.length > 0) {
          setAssets(res.data);
          setSelectedAssetCode(res.data[0].asset_code);
        }
      })
      .catch(() => {});
  }, []);

  const fetchHistory = async (assetCode) => {
    if (!assetCode) return;
    setLoadingHistory(true);
    try {
      const res = await getTelemetryHistory(assetCode);
      if (res.success && Array.isArray(res.data)) {
        const formatted = res.data.map((row) => ({
          time: new Date(row.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          temperature: row.temperature != null ? Number(row.temperature) : null,
          pressure: row.pressure != null ? Number(row.pressure) : null,
          current: row.current != null ? Number(row.current) : null,
          voltage: row.voltage != null ? Number(row.voltage) : null,
          humidity: row.humidity != null ? Number(row.humidity) : null,
          power: row.power != null ? Number(row.power) : null,
          vibration: row.vibration != null ? Number(row.vibration) : null,
        }));
        setHistory(formatted);
      }
    } catch {
      // Ignore background error
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (selectedAssetCode) {
      fetchHistory(selectedAssetCode);
    }
  }, [selectedAssetCode]);

  const cards = [
    {
      title: "Supply Air Temperature",
      value: liveTelemetry?.temperature != null ? `${liveTelemetry.temperature}°C` : "—",
      status: liveTelemetry?.temperature > 26 ? "High" : liveTelemetry?.temperature < 18 ? "Low" : "Optimal",
      statusColor: liveTelemetry?.temperature > 26 ? "#EF4444" : "#22C55E",
      icon: Thermometer,
      unit: "°C",
    },
    {
      title: "Refrigerant Pressure",
      value: liveTelemetry?.pressure != null ? `${liveTelemetry.pressure} bar` : "—",
      status: liveTelemetry?.pressure < 3.8 ? "Low Charge" : "Nominal",
      statusColor: liveTelemetry?.pressure < 3.8 ? "#F59E0B" : "#22C55E",
      icon: Gauge,
      unit: "bar",
    },
    {
      title: "Compressor Current",
      value: liveTelemetry?.current != null ? `${liveTelemetry.current} A` : "—",
      status: liveTelemetry?.current > 18 ? "Overload" : "Nominal",
      statusColor: liveTelemetry?.current > 18 ? "#EF4444" : "#22C55E",
      icon: Zap,
      unit: "A",
    },
    {
      title: "Supply Line Voltage",
      value: liveTelemetry?.voltage != null ? `${liveTelemetry.voltage} V` : "—",
      status: liveTelemetry?.voltage < 380 ? "Sag" : "Balanced",
      statusColor: "#10B981",
      icon: BatteryCharging,
      unit: "V",
    },
    {
      title: "Coach Humidity",
      value: liveTelemetry?.humidity != null ? `${liveTelemetry.humidity}%` : "—",
      status: "Comfort Zone",
      statusColor: "#06B6D4",
      icon: Droplets,
      unit: "%",
    },
    {
      title: "Total Power Draw",
      value: liveTelemetry?.power != null ? `${liveTelemetry.power} kW` : "—",
      status: "Steady Load",
      statusColor: "#EC4899",
      icon: Zap,
      unit: "kW",
    },
    {
      title: "Cumulative Operating Hours",
      value: liveTelemetry?.operatingHours != null ? `${liveTelemetry.operatingHours} hrs` : "—",
      status: "Logged",
      statusColor: "#8B5CF6",
      icon: Clock,
      unit: "hrs",
    },
    {
      title: "Filter Differential Pressure",
      value: liveTelemetry?.vibration != null ? `${liveTelemetry.vibration} kPa` : "—",
      status: liveTelemetry?.vibration > 1.8 ? "Clean Filter" : "Good",
      statusColor: liveTelemetry?.vibration > 1.8 ? "#F59E0B" : "#22C55E",
      icon: Waves,
      unit: "kPa",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header with Asset Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
            Live Telemetry & Sensor Instrumentation
          </h2>
          <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>
            High-frequency sensor telemetry ingested from coach microcontrollers
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 13, color: "#94A3B8", display: "flex", alignItems: "center", gap: 8 }}>
            <span>Target HVAC Unit:</span>
            <select
              value={selectedAssetCode}
              onChange={(e) => setSelectedAssetCode(e.target.value)}
              style={{
                background: "#040914",
                color: "#06B6D4",
                border: "1px solid #06B6D455",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13.5,
                fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {assets.map((a) => (
                <option key={a.asset_code} value={a.asset_code}>
                  {a.asset_code} — {a.name || "HVAC Unit"}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => fetchHistory(selectedAssetCode)}
            style={{
              background: "#111827",
              border: "1px solid #1E293B",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#94A3B8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
            }}
          >
            <RotateCw size={14} className={loadingHistory ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* 8 Sensor Telemetry Gauges */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Card key={i} hoverEffect={false} style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Icon size={18} color="#06B6D4" />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: `${c.statusColor}1A`,
                    color: c.statusColor,
                    border: `1px solid ${c.statusColor}33`,
                  }}
                >
                  {c.status}
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: "#F8FAFC" }}>
                {c.value}
              </div>
              <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>{c.title}</div>
            </Card>
          );
        })}
      </div>

      {/* Historical Telemetry Chart with Metric Switcher */}
      <Card hoverEffect={false} style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={18} color="#06B6D4" />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>
              Sensor Trend Dynamics — {selectedAssetCode || "Selected Asset"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setChartMetric("temp_pressure")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: chartMetric === "temp_pressure" ? "1px solid #06B6D4" : "1px solid #1E293B",
                background: chartMetric === "temp_pressure" ? "#06B6D422" : "transparent",
                color: chartMetric === "temp_pressure" ? "#06B6D4" : "#94A3B8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Temperature & Pressure
            </button>
            <button
              onClick={() => setChartMetric("power_current")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: chartMetric === "power_current" ? "1px solid #F59E0B" : "1px solid #1E293B",
                background: chartMetric === "power_current" ? "#F59E0B22" : "transparent",
                color: chartMetric === "power_current" ? "#F59E0B" : "#94A3B8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Power & Current
            </button>
            <button
              onClick={() => setChartMetric("filter_dp")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: chartMetric === "filter_dp" ? "1px solid #3B82F6" : "1px solid #1E293B",
                background: chartMetric === "filter_dp" ? "#3B82F622" : "transparent",
                color: chartMetric === "filter_dp" ? "#3B82F6" : "#94A3B8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Filter DP & Voltage
            </button>
          </div>
        </div>

        {history.length > 0 ? (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#0B1220",
                    border: "1px solid #1E293B",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#F8FAFC",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />

                {chartMetric === "temp_pressure" && (
                  <>
                    <Line type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#06B6D4" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pressure" name="Pressure (bar)" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  </>
                )}

                {chartMetric === "power_current" && (
                  <>
                    <Line type="monotone" dataKey="power" name="Power (kW)" stroke="#EC4899" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="current" name="Current (A)" stroke="#F59E0B" strokeWidth={2} dot={false} />
                  </>
                )}

                {chartMetric === "filter_dp" && (
                  <>
                    <Line type="monotone" dataKey="vibration" name="Filter DP (kPa)" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="voltage" name="Voltage (V)" stroke="#10B981" strokeWidth={2} dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#64748B", fontSize: 13 }}>
            Telemetry history for {selectedAssetCode} will populate as the simulator streams readings.
          </div>
        )}
      </Card>
    </div>
  );
}
