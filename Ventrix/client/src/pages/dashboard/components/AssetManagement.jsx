import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, X, Pencil, Box, Calendar, ShieldCheck,
  MapPin, Settings2, Activity as ActivityIcon,
} from "lucide-react";
import {
  getAssets,
  createAsset,
  updateAsset,
  updateAssetStatus,
} from "../../../services/assetService";
import { getTelemetryHistory } from "../../../services/telemetryService";

const STATUS_OPTIONS = ["OPERATIONAL", "WARNING", "MAINTENANCE", "OFFLINE", "DECOMMISSIONED"];

const STATUS_COLOR = {
  OPERATIONAL: { c: "#22C55E", bg: "#22C55E1A" },
  WARNING: { c: "#F59E0B", bg: "#F59E0B1A" },
  MAINTENANCE: { c: "#F59E0B", bg: "#F59E0B1A" },
  OFFLINE: { c: "#EF4444", bg: "#EF444419" },
  DECOMMISSIONED: { c: "#94A3B8", bg: "#94A3B81A" },
};

const EMPTY_FORM = {
  asset_code: "",
  name: "",
  product_id: "",
  coach_id: "",
  serial_number: "",
  install_date: "",
  warranty_end: "",
  zone: "",
  status: "OPERATIONAL",
};

/**
 * Full Asset Management page — real data, backed by GET/POST/PUT
 * /api/assets and PATCH /api/assets/:code/status. This replaces the
 * old telemetry-derived placeholder list.
 */
export default function AssetManagement({ COLORS, Card }) {
  const [assets, setAssets] = useState([]);
  const [products, setProducts] = useState([]);
  const [coachOptions, setCoachOptions] = useState([]); // flattened, labeled with train number
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [trainFilter, setTrainFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState(null); // null = creating
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [selectedCode, setSelectedCode] = useState(null);

  async function load() {
    try {
      const res = await getAssets();
      if (!res.success) {
        setError(res.message || "Failed to load assets");
        return;
      }
      setAssets(res.data || []);
      setError(null);
    } catch (err) {
      setError("Could not reach the backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const trains = useMemo(
    () => Array.from(new Set(assets.map((a) => a.train_number).filter(Boolean))).sort(),
    [assets]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (trainFilter !== "ALL" && a.train_number !== trainFilter) return false;
      if (!q) return true;
      return (
        a.asset_code?.toLowerCase().includes(q) ||
        a.name?.toLowerCase().includes(q) ||
        a.model?.toLowerCase().includes(q) ||
        a.product_name?.toLowerCase().includes(q) ||
        a.zone?.toLowerCase().includes(q)
      );
    });
  }, [assets, search, statusFilter, trainFilter]);

  const counts = useMemo(() => {
    const base = { TOTAL: assets.length };
    STATUS_OPTIONS.forEach((s) => (base[s] = 0));
    assets.forEach((a) => {
      if (base[a.status] !== undefined) base[a.status] += 1;
    });
    return base;
  }, [assets]);

  function openCreate() {
    setEditingCode(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(asset) {
    setEditingCode(asset.asset_code);
    setForm({
      asset_code: asset.asset_code || "",
      name: asset.name || "",
      product_id: asset.product_id || "",
      coach_id: asset.coach_id || "",
      serial_number: asset.serial_number || "",
      install_date: asset.install_date ? asset.install_date.slice(0, 10) : "",
      warranty_end: asset.warranty_end ? asset.warranty_end.slice(0, 10) : "",
      zone: asset.zone || "",
      status: asset.status || "OPERATIONAL",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function submitForm(e) {
    e.preventDefault();
    if (!form.asset_code.trim() || !form.name.trim()) {
      setFormError("Asset Code and Name are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = editingCode
        ? await updateAsset(editingCode, form)
        : await createAsset(form);

      if (!res.success) {
        setFormError(res.message || "Save failed.");
        return;
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError("Could not reach the backend.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(assetCode, status) {
    const res = await updateAssetStatus(assetCode, status);
    if (res.success) {
      setAssets((prev) =>
        prev.map((a) => (a.asset_code === assetCode ? { ...a, status } : a))
      );
    }
  }

  const selected = assets.find((a) => a.asset_code === selectedCode) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && (
        <Banner COLORS={COLORS} tone="danger">
          {error}
        </Banner>
      )}
      {!error && loading && (
        <Banner COLORS={COLORS} tone="primary">
          Loading assets…
        </Banner>
      )}

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        <MiniStat COLORS={COLORS} label="Total HVAC" value={counts.TOTAL} color={COLORS.primary} />
        {STATUS_OPTIONS.map((s) => (
          <MiniStat
            key={s}
            COLORS={COLORS}
            label={s.charAt(0) + s.slice(1).toLowerCase()}
            value={counts[s]}
            color={STATUS_COLOR[s].c}
          />
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, background: COLORS.card,
            border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", flex: 1, minWidth: 220,
          }}
        >
          <Search size={15} color={COLORS.muted} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, name, model, location…"
            style={{
              background: "transparent", border: "none", outline: "none", color: COLORS.white,
              fontSize: 13, width: "100%", fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>

        <SelectPill COLORS={COLORS} value={statusFilter} onChange={setStatusFilter}>
          <option value="ALL">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </SelectPill>

        <SelectPill COLORS={COLORS} value={trainFilter} onChange={setTrainFilter}>
          <option value="ALL">All trains</option>
          {trains.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </SelectPill>

        <button
          onClick={openCreate}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10,
            border: "none", cursor: "pointer", background: COLORS.primary, color: "#00131A",
            fontWeight: 600, fontSize: 13, fontFamily: "'Inter', sans-serif",
          }}
        >
          <Plus size={16} /> Add HVAC Unit
        </button>
      </div>

      {/* Asset list */}
      <Card>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: COLORS.muted, fontSize: 12 }}>
                <th style={{ padding: "8px 4px", fontWeight: 500 }}>Asset</th>
                <th style={{ padding: "8px 4px", fontWeight: 500 }}>Train / Coach</th>
                <th style={{ padding: "8px 4px", fontWeight: 500 }}>Model</th>
                <th style={{ padding: "8px 4px", fontWeight: 500 }}>Location</th>
                <th style={{ padding: "8px 4px", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "8px 4px", fontWeight: 500 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.asset_code}
                  style={{ borderTop: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                  onClick={() => setSelectedCode(a.asset_code)}
                >
                  <td style={{ padding: "12px 4px" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{a.asset_code}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{a.name}</div>
                  </td>
                  <td style={{ padding: "12px 4px" }}>
                    {a.train_number || "—"} {a.coach_number ? `/ ${a.coach_number}` : ""}
                  </td>
                  <td style={{ padding: "12px 4px" }}>{a.product_name || "—"}</td>
                  <td style={{ padding: "12px 4px" }}>{a.zone || "—"}</td>
                  <td style={{ padding: "12px 4px" }}>
                    <StatusSelect
                      COLORS={COLORS}
                      value={a.status}
                      onChange={(s) => changeStatus(a.asset_code, s)}
                    />
                  </td>
                  <td style={{ padding: "12px 4px", textAlign: "right" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(a);
                      }}
                      style={{
                        background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12,
                      }}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "24px 4px", textAlign: "center", color: COLORS.muted }}>
                    No assets match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && (
        <AssetFormModal
          COLORS={COLORS}
          form={form}
          setForm={setForm}
          onSubmit={submitForm}
          onClose={() => setShowForm(false)}
          error={formError}
          saving={saving}
          isEditing={!!editingCode}
          products={products}
          coachOptions={coachOptions}
        />
      )}

      {selected && (
        <AssetDetailsDrawer
          COLORS={COLORS}
          asset={selected}
          onClose={() => setSelectedCode(null)}
          onEdit={() => {
            openEdit(selected);
            setSelectedCode(null);
          }}
        />
      )}
    </div>
  );
}

function Banner({ COLORS, tone, children }) {
  const color = COLORS[tone] || COLORS.primary;
  return (
    <div
      style={{
        padding: "12px 16px", borderRadius: 10, background: `${color}1A`,
        border: `1px solid ${color}55`, color, fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

function MiniStat({ COLORS, label, value, color }) {
  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 14px",
    }}>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 20, color }}>
        {value}
      </div>
    </div>
  );
}

function SelectPill({ COLORS, value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: COLORS.card, color: COLORS.white, border: `1px solid ${COLORS.border}`,
        borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "'Inter', sans-serif",
        outline: "none", cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

function StatusSelect({ COLORS, value, onChange }) {
  const s = STATUS_COLOR[value] || STATUS_COLOR.OPERATIONAL;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: s.bg, color: s.c, border: `1px solid ${s.c}55`, borderRadius: 20,
        padding: "4px 10px", fontSize: 12, fontWeight: 500, outline: "none", cursor: "pointer",
      }}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt} value={opt} style={{ background: COLORS.card, color: COLORS.white }}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function FormField({ COLORS, label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: COLORS.muted }}>
      {label}
      {children}
    </label>
  );
}

function textInputStyle(COLORS) {
  return {
    background: COLORS.bg, color: COLORS.white, border: `1px solid ${COLORS.border}`,
    borderRadius: 8, padding: "9px 10px", fontSize: 13.5, outline: "none", fontFamily: "'Inter', sans-serif",
  };
}

function AssetFormModal({ COLORS, form, setForm, onSubmit, onClose, error, saving, isEditing, products, coachOptions }) {
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(3,7,18,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
          padding: 28, width: 560, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 18 }}>
            {isEditing ? `Edit ${form.asset_code}` : "Add HVAC Unit"}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {error && <Banner COLORS={COLORS} tone="danger">{error}</Banner>}

        <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: error ? 14 : 0 }}>
          <FormField COLORS={COLORS} label="Asset Code *">
            <input
              value={form.asset_code}
              onChange={set("asset_code")}
              disabled={isEditing}
              placeholder="HVAC-007"
              style={{ ...textInputStyle(COLORS), opacity: isEditing ? 0.6 : 1 }}
            />
          </FormField>
          <FormField COLORS={COLORS} label="Name *">
            <input value={form.name} onChange={set("name")} placeholder="Coach D2 HVAC Unit" style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Model / Type">
            <input value={form.zone} onChange={set("zone")} placeholder="e.g. Roof-Mounted HVAC Unit" style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Serial Number">
            <input value={form.serial_number} onChange={set("serial_number")} placeholder="VT500-007" style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Location">
            <input value={form.zone} onChange={set("zone")} placeholder="Coach D2" style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Installation Date">
            <input type="date" value={form.install_date} onChange={set("install_date")} style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Warranty End">
            <input type="date" value={form.warranty_end} onChange={set("warranty_end")} style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Status">
            <select value={form.status} onChange={set("status")} style={textInputStyle(COLORS)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 18px", borderRadius: 10, border: `1px solid ${COLORS.border}`,
                background: "transparent", color: COLORS.muted, cursor: "pointer", fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "9px 18px", borderRadius: 10, border: "none", background: COLORS.primary,
                color: "#00131A", fontWeight: 600, cursor: "pointer", fontSize: 13, opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailRow({ COLORS, icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: `${COLORS.primary}1A`,
        display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.primary, flexShrink: 0,
      }}>
        <Icon size={14} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: COLORS.muted }}>{label}</div>
        <div style={{ fontSize: 13.5, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function AssetDetailsDrawer({ COLORS, asset, onClose, onEdit }) {
  const [tab, setTab] = useState("overview");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (tab !== "telemetry") return;
    let cancelled = false;
    setHistoryLoading(true);
    getTelemetryHistory(asset.asset_code, 20)
      .then((res) => {
        if (!cancelled && res.success) setHistory(res.data || []);
      })
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, asset.asset_code]);

  const config = asset.metadata || {};
  const s = STATUS_COLOR[asset.status] || STATUS_COLOR.OPERATIONAL;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(3,7,18,0.6)", zIndex: 40, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxWidth: "100%", height: "100%", background: COLORS.card,
          borderLeft: `1px solid ${COLORS.border}`, padding: 28, overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 20 }}>{asset.asset_code}</div>
            <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 2 }}>{asset.name}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20,
          fontSize: 12, fontWeight: 500, color: s.c, background: s.bg, marginTop: 8,
        }}>
          {asset.status}
        </span>

        <div style={{ display: "flex", gap: 4, marginTop: 20, borderBottom: `1px solid ${COLORS.border}` }}>
          {["overview", "configuration", "telemetry"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "transparent", border: "none", cursor: "pointer", padding: "10px 4px", marginRight: 16,
                fontSize: 13, fontWeight: 500, textTransform: "capitalize",
                color: tab === t ? COLORS.primary : COLORS.muted,
                borderBottom: tab === t ? `2px solid ${COLORS.primary}` : "2px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ paddingTop: 20 }}>
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <DetailRow COLORS={COLORS} icon={Box} label="Train / Coach" value={`${asset.train_number || "—"} / ${asset.coach_number || "—"}`} />
              <DetailRow COLORS={COLORS} icon={MapPin} label="Location" value={asset.zone || "—"} />
              <DetailRow COLORS={COLORS} icon={Settings2} label="Product" value={asset.product_name ? `${asset.product_name} (${asset.product_code})` : "—"} />
              <DetailRow COLORS={COLORS} icon={ActivityIcon} label="Serial Number" value={asset.serial_number || "—"} />
              <DetailRow COLORS={COLORS} icon={Calendar} label="Installed" value={asset.install_date ? asset.install_date.slice(0, 10) : "—"} />
              <DetailRow
                COLORS={COLORS}
                icon={ShieldCheck}
                label="Warranty"
                value={asset.warranty_end ? `Until ${asset.warranty_end.slice(0, 10)}` : "—"}
              />
              <DetailRow COLORS={COLORS} icon={Calendar} label="Registered" value={asset.created_at ? asset.created_at.slice(0, 10) : "—"} />
              <DetailRow COLORS={COLORS} icon={Calendar} label="Last Updated" value={asset.updated_at ? asset.updated_at.slice(0, 10) : "—"} />

              <button
                onClick={onEdit}
                style={{
                  marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "10px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "transparent",
                  color: COLORS.white, cursor: "pointer", fontSize: 13,
                }}
              >
                <Pencil size={14} /> Edit Asset
              </button>
            </div>
          )}

          {tab === "configuration" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.keys(config).length === 0 && (
                <div style={{ color: COLORS.muted, fontSize: 13 }}>No configuration recorded for this unit yet.</div>
              )}
              {Object.entries(config).map(([key, value]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
                  <span style={{ color: COLORS.muted, textTransform: "capitalize" }}>
                    {key.replace(/([A-Z])/g, " $1")}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{String(value)}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "telemetry" && (
            <div>
              {historyLoading && <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading recent readings…</div>}
              {!historyLoading && history.length === 0 && (
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  No telemetry recorded yet for this asset. Make sure the simulator is publishing this asset code.
                </div>
              )}
              {!historyLoading && history.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.map((row) => (
                    <div key={row.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}>
                      <span style={{ color: COLORS.muted }}>
                        {row.recorded_at ? new Date(row.recorded_at).toLocaleTimeString() : "—"}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {row.temperature ?? "—"}°C · {row.pressure ?? "—"} bar · {row.current ?? "—"} A
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
