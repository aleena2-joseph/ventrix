import React, { useState, useEffect, useMemo } from "react";
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
  Radio,
  CheckCircle2,
  AlertTriangle,
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
import { getTelemetryHistory, getLatestTelemetry } from "../../../services/telemetryService";
import { getAssets } from "../../../services/assetService";

export default function TelemetryPage({ telemetry: initialTelemetry, telemetryRows = [] }) {
  const [assets, setAssets] = useState([]);
  const [selectedAssetCode, setSelectedAssetCode] = useState("HVAC-001");
  const [history, setHistory] = useState([]);
  const [liveData, setLiveData] = useState(initialTelemetry || {});
  const [chartMetric, setChartMetric] = useState("temp_pressure");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Load available assets
  useEffect(() => {
    getAssets()
      .then((res) => {
        if (res.success && res.data?.length > 0) {
          setAssets(res.data);
          if (!selectedAssetCode) {
            setSelectedAssetCode(res.data[0].asset_code);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch history for selected asset
  const fetchHistory = async (assetCode) => {
    if (!assetCode) return;
    try {
      const res = await getTelemetryHistory(assetCode, 30);
      if (res.success && Array.isArray(res.data)) {
        const formatted = res.data.reverse().map((row) => ({
          time: new Date(row.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          temperature: row.temperature != null ? Number(row.temperature) : null,
          pressure: row.pressure != null ? Number(row.pressure) : null,
          current: row.current != null ? Number(row.current) : null,
          voltage: row.voltage != null ? Number(row.voltage) : null,
          humidity: row.humidity != null ? Number(row.humidity) : null,
          power: row.power != null ? Number(row.power) : null,
          vibration: row.vibration != null ? Number(row.vibration) : null,
          filterDP: row.filter_dp != null ? Number(row.filter_dp) : (row.raw_payload?.telemetry?.filterDP != null ? Number(row.raw_payload.telemetry.filterDP) : null),
        }));
        setHistory(formatted);
      }
    } catch {
      // Ignore background error
    }
  };

  // Poll latest telemetry and history continuously every 2.5 seconds
  useEffect(() => {
    let active = true;

    async function pollLiveTelemetry() {
      try {
        const [telRes] = await Promise.all([
          getLatestTelemetry(),
          fetchHistory(selectedAssetCode),
        ]);

        if (!active) return;

        if (telRes?.success && Array.isArray(telRes.data)) {
          const matched = telRes.data.find(
            (r) => r.asset_code === selectedAssetCode || r.assetId === selectedAssetCode
          );
          const target = matched || telRes.data[0];

          if (target) {
            setLiveData({
              temperature: target.temperature != null ? Number(target.temperature) : null,
              pressure: target.pressure != null ? Number(target.pressure) : null,
              current: target.current != null ? Number(target.current) : null,
              voltage: target.voltage != null ? Number(target.voltage) : null,
              humidity: target.humidity != null ? Number(target.humidity) : null,
              power: target.power != null ? Number(target.power) : null,
              operatingHours: target.operating_hours != null ? Number(target.operating_hours) : null,
              vibration: target.vibration != null ? Number(target.vibration) : null,
              filterDP: target.raw_payload?.telemetry?.filterDP != null ? Number(target.raw_payload.telemetry.filterDP) : null,
              assetState: target.asset_state || "NOMINAL",
              healthScore: target.predicted_health_score != null ? Number(target.predicted_health_score) : 95,
            });
            setLastUpdated(new Date());
          }
        }
      } catch {
        // Silent poll
      }
    }

    pollLiveTelemetry();
    const interval = setInterval(pollLiveTelemetry, 2500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedAssetCode]);

  const cards = [
    {
      title: "Supply Air Temperature",
      value: liveData?.temperature != null ? `${liveData.temperature.toFixed(1)}°C` : "—",
      status: liveData?.temperature > 26 ? "High Temp" : liveData?.temperature < 18 ? "Low Temp" : "Optimal",
      statusColor: liveData?.temperature > 26 ? "#EF4444" : "#10B981",
      icon: Thermometer,
      unit: "°C",
    },
    {
      title: "Refrigerant Pressure",
      value: liveData?.pressure != null ? `${liveData.pressure.toFixed(2)} bar` : "—",
      status: liveData?.pressure < 3.8 ? "Low Pressure" : "Nominal",
      statusColor: liveData?.pressure < 3.8 ? "#F59E0B" : "#10B981",
      icon: Gauge,
      unit: "bar",
    },
    {
      title: "Compressor Current",
      value: liveData?.current != null ? `${liveData.current.toFixed(1)} A` : "—",
      status: liveData?.current > 18 ? "High Current" : "Normal Load",
      statusColor: liveData?.current > 18 ? "#EF4444" : "#10B981",
      icon: Zap,
      unit: "A",
    },
    {
      title: "Supply Line Voltage",
      value: liveData?.voltage != null ? `${Math.round(liveData.voltage)} V` : "—",
      status: liveData?.voltage < 380 ? "Voltage Sag" : "Balanced",
      statusColor: "#10B981",
      icon: BatteryCharging,
      unit: "V",
    },
    {
      title: "Coach Humidity",
      value: liveData?.humidity != null ? `${Math.round(liveData.humidity)}%` : "—",
      status: "Comfort Band",
      statusColor: "#06B6D4",
      icon: Droplets,
      unit: "%",
    },
    {
      title: "Total Power Draw",
      value: liveData?.power != null ? `${liveData.power.toFixed(2)} kW` : "—",
      status: "Steady Load",
      statusColor: "#EC4899",
      icon: Zap,
      unit: "kW",
    },
    {
      title: "Cumulative Operating Hours",
      value: liveData?.operatingHours != null ? `${Math.round(liveData.operatingHours)} hrs` : "—",
      status: "Logged",
      statusColor: "#8B5CF6",
      icon: Clock,
      unit: "hrs",
    },
    {
      title: "Filter Differential Pressure",
      value: liveData?.filterDP != null ? `${liveData.filterDP} Pa` : (liveData?.vibration != null ? `${liveData.vibration} Pa` : "—"),
      status: (liveData?.filterDP || 0) > 250 ? "Filter Clogged" : "Airflow Normal",
      statusColor: (liveData?.filterDP || 0) > 250 ? "#F59E0B" : "#10B981",
      icon: Waves,
      unit: "Pa",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header with Live Ticker & Asset Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                borderRadius: 6,
                background: "rgba(16,185,129,0.15)",
                color: "#10B981",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", animation: "pulse 1.5s infinite" }} />
              LIVE TELEMETRY STREAMING
            </span>
            <span style={{ fontSize: 12, color: "#64748B" }}>
              Last Signal: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>
            Live Telemetry & Sensor Feeds
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {assets.length === 0 ? (
                <>
                  <option value="HVAC-001">HVAC-001 — Coach A1</option>
                  <option value="HVAC-002">HVAC-002 — Coach A2</option>
                  <option value="HVAC-003">HVAC-003 — Coach B1</option>
                  <option value="HVAC-004">HVAC-004 — Coach B2</option>
                  <option value="HVAC-005">HVAC-005 — Coach C1</option>
                </>
              ) : (
                assets.map((a) => (
                  <option key={a.asset_code} value={a.asset_code}>
                    {a.asset_code} — {a.name || "HVAC Unit"}
                  </option>
                ))
              )}
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
              fontWeight: 600,
            }}
          >
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* 8 Sensor Instruments Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Card key={i} hoverEffect={true}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{c.title}</span>
                <Icon size={18} color="#06B6D4" />
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                {c.value}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 4,
                    color: c.statusColor,
                    background: `${c.statusColor}1A`,
                  }}
                >
                  {c.status}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Real-time Time Series Sensor Trend Chart */}
      <Card hoverEffect={false}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>
              Live Sensor Signal History — {selectedAssetCode}
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>
              Time-series readings updated continuously as simulator pulses arrive
            </div>
          </div>

          {/* Metric Filter Tabs */}
          <div style={{ display: "flex", gap: 6, background: "#060A14", padding: 4, borderRadius: 8, border: "1px solid #1E293B" }}>
            <button
              onClick={() => setChartMetric("temp_pressure")}
              style={{
                background: chartMetric === "temp_pressure" ? "#0284C7" : "transparent",
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Temp & Pressure
            </button>
            <button
              onClick={() => setChartMetric("current_power")}
              style={{
                background: chartMetric === "current_power" ? "#0284C7" : "transparent",
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Current & Power
            </button>
            <button
              onClick={() => setChartMetric("filter_vibration")}
              style={{
                background: chartMetric === "filter_vibration" ? "#0284C7" : "transparent",
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Filter DP & Voltage
            </button>
          </div>
        </div>

        <div style={{ height: 280, width: "100%" }}>
          {history.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748B", fontSize: 13 }}>
              Waiting for live sensor data stream... Run `npm run stream` in Railway-Simulation/hvac_fix
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#0B1220",
                    border: "1px solid #1E293B",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#fff",
                  }}
                />
                <Legend />

                {chartMetric === "temp_pressure" && (
                  <>
                    <Line type="monotone" dataKey="temperature" stroke="#06B6D4" strokeWidth={2} name="Supply Temp (°C)" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="pressure" stroke="#10B981" strokeWidth={2} name="Refrigerant Pressure (bar)" dot={false} isAnimationActive={false} />
                  </>
                )}

                {chartMetric === "current_power" && (
                  <>
                    <Line type="monotone" dataKey="current" stroke="#F59E0B" strokeWidth={2} name="Compressor Current (A)" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="power" stroke="#EC4899" strokeWidth={2} name="Power Draw (kW)" dot={false} isAnimationActive={false} />
                  </>
                )}

                {chartMetric === "filter_vibration" && (
                  <>
                    <Line type="monotone" dataKey="filterDP" stroke="#8B5CF6" strokeWidth={2} name="Filter DP (Pa)" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="voltage" stroke="#3B82F6" strokeWidth={2} name="Supply Voltage (V)" dot={false} isAnimationActive={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
