import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, X, Pencil, Box, Calendar, ShieldCheck,
  MapPin, Settings2, Activity as ActivityIcon, Archive,
  Trash2, CheckCircle2, AlertTriangle, Shield,
} from "lucide-react";
import {
  getAssets,
  createAsset,
  updateAsset,
  decommissionAsset,
} from "../../../services/assetService";
import { getTelemetryHistory } from "../../../services/telemetryService";
import { getLocations, createLocation, deleteLocation } from "../../../services/locationService";

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
  asset_type: "Roof-Mounted HVAC Unit",
  product_id: "",
  coach_id: "",
  serial_number: "",
  install_date: "",
  warranty_end: "",
  zone: "",
  status: "OPERATIONAL",
};

export default function AssetManagement({ COLORS, Card, user, role }) {
  const currentUser = user || (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();
  const userRole = (role || currentUser?.role_name || currentUser?.role || "").toUpperCase();
  const isAdmin = userRole === "ADMIN" || userRole === "VENTRIX_ADMIN" || userRole === "SUPER_ADMIN";

  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [trainFilter, setTrainFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState(null); // null = creating
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [selectedCode, setSelectedCode] = useState(null);

  // Admin Location Modals
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showLocationManager, setShowLocationManager] = useState(false);

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

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

  async function loadLocationsList() {
    try {
      const res = await getLocations();
      if (res?.success && Array.isArray(res.data)) {
        setLocations(res.data);
      }
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  }

  useEffect(() => {
    load();
    loadLocationsList();
    const timer = setInterval(() => {
      getAssets()
        .then((res) => {
          if (res.success && Array.isArray(res.data)) {
            setAssets(res.data);
          }
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
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

  const openEdit = (asset) => {
    setEditingCode(asset.asset_code);
    setForm({
      asset_code: asset.asset_code || "",
      name: asset.name || "",
      asset_type: asset.asset_type || "Roof-Mounted HVAC Unit",
      product_id: asset.product_id ? String(asset.product_id) : "",
      coach_id: asset.coach_id ? String(asset.coach_id) : "",
      serial_number: asset.serial_number || "",
      install_date: asset.install_date ? asset.install_date.slice(0, 10) : "",
      warranty_end: asset.warranty_end ? asset.warranty_end.slice(0, 10) : "",
      zone: asset.zone || "",
      status: asset.status || "OPERATIONAL",
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleDecommission = async (assetCode) => {
    if (
      !window.confirm(
        `Are you sure you want to decommission HVAC unit ${assetCode}? This permanently sets status to DECOMMISSIONED and archives it from active rail service.`
      )
    ) {
      return;
    }
    try {
      await decommissionAsset(assetCode);
      setSelectedCode(null);
      notify("success", `Asset ${assetCode} marked as Decommissioned.`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to decommission asset.");
    }
  };

  async function submitForm(e) {
    e.preventDefault();
    if (!form.asset_code.trim() || !form.name.trim()) {
      setFormError("Asset Code and Name are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        asset_code: form.asset_code.trim(),
        name: form.name.trim(),
        product_id: form.product_id ? parseInt(form.product_id, 10) : null,
        coach_id: form.coach_id ? parseInt(form.coach_id, 10) : null,
        install_date: form.install_date || null,
        warranty_end: form.warranty_end || null,
        zone: form.zone?.trim() || null,
        serial_number: form.serial_number?.trim() || null,
      };

      const res = editingCode
        ? await updateAsset(editingCode, payload)
        : await createAsset(payload);

      if (!res.success) {
        setFormError(res.message || "Save failed.");
        return;
      }
      setShowForm(false);
      notify("success", editingCode ? `Asset ${editingCode} updated successfully.` : `Asset ${payload.asset_code} created successfully.`);
      await load();
    } catch (err) {
      setFormError(err?.response?.data?.message || err.message || "Could not reach the backend.");
    } finally {
      setSaving(false);
    }
  }

  const selected = assets.find((a) => a.asset_code === selectedCode) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 110,
            background: toast.type === "success" ? "#064E3B" : "#7F1D1D",
            border: `1px solid ${toast.type === "success" ? "#10B981" : "#EF4444"}`,
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {error && (
        <Banner COLORS={COLORS} tone="danger">
          {error}
        </Banner>
      )}
      {!error && loading && (
        <Banner COLORS={COLORS} tone="primary">
          Loading HVAC assets…
        </Banner>
      )}

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <MiniStat COLORS={COLORS} label="Total Registered" value={counts.TOTAL} color={COLORS.primary} />
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
            placeholder="Search by code, coach, depot location…"
            style={{
              background: "transparent", border: "none", outline: "none", color: COLORS.white,
              fontSize: 13, width: "100%", fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>

        <SelectPill COLORS={COLORS} value={statusFilter} onChange={setStatusFilter}>
          <option value="ALL">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </SelectPill>

        <SelectPill COLORS={COLORS} value={trainFilter} onChange={setTrainFilter}>
          <option value="ALL">All Trains</option>
          {trains.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </SelectPill>

        {/* Location Manager Button for Admins */}
        {isAdmin && (
          <button
            onClick={() => setShowLocationManager(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10,
              border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.05)",
              color: COLORS.white, cursor: "pointer", fontSize: 13, fontWeight: 500,
            }}
            title="Manage railway depots, yards, and coach locations (Admin only)"
          >
            <MapPin size={15} color={COLORS.primary} />
            Depots & Locations
          </button>
        )}

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
                <th style={{ padding: "10px 8px", fontWeight: 500 }}>Asset Code</th>
                <th style={{ padding: "10px 8px", fontWeight: 500 }}>Train / Coach</th>
                <th style={{ padding: "10px 8px", fontWeight: 500 }}>Model / Spec</th>
                <th style={{ padding: "10px 8px", fontWeight: 500 }}>Depot Location</th>
                <th style={{ padding: "10px 8px", fontWeight: 500 }}>Operational State</th>
                <th style={{ padding: "10px 8px", fontWeight: 500, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.asset_code}
                  style={{ borderTop: `1px solid ${COLORS.border}`, cursor: "pointer" }}
                  onClick={() => setSelectedCode(a.asset_code)}
                >
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{a.asset_code}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{a.name}</div>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    {a.train_number || "—"} {a.coach_number ? `/ ${a.coach_number}` : ""}
                  </td>
                  <td style={{ padding: "12px 8px" }}>{a.product_name || a.asset_type || "Roof-Mounted Unit"}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <MapPin size={13} color={COLORS.primary} />
                      {a.zone || "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <StatusBadge value={a.status} />
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(a);
                      }}
                      style={{
                        background: "transparent", border: "none", color: COLORS.primary, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600,
                      }}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "28px 8px", textAlign: "center", color: COLORS.muted }}>
                    No HVAC assets found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Asset Modal */}
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
          locations={locations}
          isAdmin={isAdmin}
          onOpenAddLocation={() => setShowAddLocationModal(true)}
        />
      )}

      {/* Asset Details Drawer */}
      {selected && (
        <AssetDetailsDrawer
          COLORS={COLORS}
          asset={selected}
          onClose={() => setSelectedCode(null)}
          onEdit={() => {
            openEdit(selected);
            setSelectedCode(null);
          }}
          onDecommission={() => handleDecommission(selected.asset_code)}
        />
      )}

      {/* Add Location Modal (Admin Only) */}
      {showAddLocationModal && (
        <AddLocationModal
          COLORS={COLORS}
          onClose={() => setShowAddLocationModal(false)}
          onSuccess={(newLoc) => {
            loadLocationsList();
            setForm((f) => ({ ...f, zone: newLoc.name }));
            setShowAddLocationModal(false);
            notify("success", `Location "${newLoc.name}" added successfully.`);
          }}
        />
      )}

      {/* Location Manager Modal (Admin Only) */}
      {showLocationManager && (
        <LocationManagerModal
          COLORS={COLORS}
          locations={locations}
          onClose={() => setShowLocationManager(false)}
          onRefresh={loadLocationsList}
          onOpenAdd={() => setShowAddLocationModal(true)}
          notify={notify}
        />
      )}
    </div>
  );
}

function Banner({ COLORS, tone, children }) {
  const color = tone === "danger" ? "#EF4444" : COLORS.primary;
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

function StatusBadge({ value }) {
  const s = STATUS_COLOR[value] || STATUS_COLOR.OPERATIONAL;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: s.c,
        background: s.bg,
        border: `1px solid ${s.c}44`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.c,
          boxShadow: `0 0 6px ${s.c}`,
          display: "inline-block",
        }}
      />
      {value || "OPERATIONAL"}
    </div>
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

function AssetFormModal({
  COLORS,
  form,
  setForm,
  onSubmit,
  onClose,
  error,
  saving,
  isEditing,
  locations = [],
  isAdmin,
  onOpenAddLocation,
}) {
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
          padding: 28, width: 580, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto",
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
            <input value={form.asset_type} onChange={set("asset_type")} placeholder="Roof-Mounted HVAC Unit" style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Serial Number">
            <input value={form.serial_number} onChange={set("serial_number")} placeholder="VT500-007" style={textInputStyle(COLORS)} />
          </FormField>

          {/* Location Dropdown with Admin-Only Addition */}
          <div style={{ gridColumn: "1 / -1" }}>
            <FormField
              COLORS={COLORS}
              label={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>Location / Depot *</span>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={onOpenAddLocation}
                      style={{
                        background: "none",
                        border: "none",
                        color: COLORS.primary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: 0,
                      }}
                    >
                      <Plus size={13} /> Add Location (Admin Only)
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: COLORS.muted }}>(Managed by Admin)</span>
                  )}
                </div>
              }
            >
              <select
                value={form.zone || ""}
                onChange={set("zone")}
                style={{ ...textInputStyle(COLORS), cursor: "pointer", width: "100%" }}
                required
              >
                <option value="">-- Choose Railway Location / Depot --</option>
                {locations.map((loc) => (
                  <option key={loc.id || loc.name} value={loc.name}>
                    {loc.name} {loc.code ? `[${loc.code}]` : ""} ({loc.type || "DEPOT"})
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField COLORS={COLORS} label="Installation Date">
            <input type="date" value={form.install_date} onChange={set("install_date")} style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Warranty End">
            <input type="date" value={form.warranty_end} onChange={set("warranty_end")} style={textInputStyle(COLORS)} />
          </FormField>
          <FormField COLORS={COLORS} label="Operational Status">
            <div
              style={{
                ...textInputStyle(COLORS),
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.03)",
                color: COLORS.muted,
                fontSize: 12.5,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: (STATUS_COLOR[form.status] || STATUS_COLOR.OPERATIONAL).c,
                  boxShadow: `0 0 6px ${(STATUS_COLOR[form.status] || STATUS_COLOR.OPERATIONAL).c}`,
                }}
              />
              <span>
                <strong style={{ color: (STATUS_COLOR[form.status] || STATUS_COLOR.OPERATIONAL).c }}>
                  {form.status || "OPERATIONAL"}
                </strong>{" "}
                <span style={{ fontSize: 11, color: COLORS.muted }}>(Live Sensor Sync)</span>
              </span>
            </div>
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

// Modal for Admin to create a new railway location
function AddLocationModal({ COLORS, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("DEPOT");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Location Name is required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await createLocation({
        name: name.trim(),
        code: code.trim() || null,
        type,
        description: description.trim() || null,
      });
      if (res?.success) {
        onSuccess(res.data);
      } else {
        setErr(res?.message || "Failed to create location.");
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to create location.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(3,7,18,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
          padding: 24, width: 460, maxWidth: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={18} color={COLORS.primary} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Add Railway Location (Admin Only)</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {err && <div style={{ marginBottom: 14 }}><Banner COLORS={COLORS} tone="danger">{err}</Banner></div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FormField COLORS={COLORS} label="Location / Depot Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coach D3 or Howrah Maintenance Shed"
              style={textInputStyle(COLORS)}
              required
            />
          </FormField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField COLORS={COLORS} label="Code (Optional)">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. LOC-D3 or DEPOT-HWH"
                style={textInputStyle(COLORS)}
              />
            </FormField>

            <FormField COLORS={COLORS} label="Location Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ ...textInputStyle(COLORS), cursor: "pointer" }}
              >
                <option value="COACH">Coach</option>
                <option value="DEPOT">Depot</option>
                <option value="WORKSHOP">Workshop / Shed</option>
                <option value="YARD">Coaching Yard</option>
                <option value="STATION">Station</option>
              </select>
            </FormField>
          </div>

          <FormField COLORS={COLORS} label="Description (Optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Northern Railway Carriage & Wagon Workshop"
              rows={2}
              style={{ ...textInputStyle(COLORS), resize: "vertical" }}
            />
          </FormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                background: "transparent", color: COLORS.muted, cursor: "pointer", fontSize: 13,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "8px 18px", borderRadius: 8, border: "none", background: COLORS.primary,
                color: "#00131A", fontWeight: 600, cursor: "pointer", fontSize: 13, opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Adding..." : "Add Location"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal for Admin to manage all locations
function LocationManagerModal({ COLORS, locations, onClose, onRefresh, onOpenAdd, notify }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filteredLocs = locations.filter((loc) => {
    const q = searchTerm.toLowerCase();
    return (
      loc.name?.toLowerCase().includes(q) ||
      loc.code?.toLowerCase().includes(q) ||
      loc.type?.toLowerCase().includes(q)
    );
  });

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete location "${name}"? Assets stationed here will keep their recorded zone.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await deleteLocation(id);
      if (res?.success) {
        notify("success", `Location "${name}" removed.`);
        onRefresh();
      } else {
        notify("error", res?.message || "Failed to remove location.");
      }
    } catch (err) {
      notify("error", err?.response?.data?.message || err.message || "Failed to delete location.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(3,7,18,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
          padding: 24, width: 620, maxWidth: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={18} color={COLORS.primary} />
            <span style={{ fontWeight: 600, fontSize: 17 }}>Railway Depots, Sheds & Coach Locations</span>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: COLORS.muted, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search locations..."
            style={{ ...textInputStyle(COLORS), flex: 1 }}
          />
          <button
            onClick={onOpenAdd}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
              background: COLORS.primary, border: "none", color: "#00131A", fontWeight: 600,
              fontSize: 12.5, cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add New Location
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${COLORS.border}`, borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", color: COLORS.muted, fontSize: 11.5 }}>
                <th style={{ padding: "8px 10px" }}>Location Name</th>
                <th style={{ padding: "8px 10px" }}>Code</th>
                <th style={{ padding: "8px 10px" }}>Type</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocs.map((loc) => (
                <tr key={loc.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "10px", fontWeight: 500 }}>
                    {loc.name}
                    {loc.description && <div style={{ fontSize: 11, color: COLORS.muted }}>{loc.description}</div>}
                  </td>
                  <td style={{ padding: "10px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {loc.code || "—"}
                  </td>
                  <td style={{ padding: "10px" }}>
                    <span style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 6,
                      background: "rgba(56,189,248,0.12)", color: "#38BDF8", fontWeight: 600,
                    }}>
                      {loc.type || "DEPOT"}
                    </span>
                  </td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    <button
                      onClick={() => handleDelete(loc.id, loc.name)}
                      disabled={deletingId === loc.id}
                      style={{
                        background: "transparent", border: "none", color: "#EF4444",
                        cursor: "pointer", padding: "4px 8px", borderRadius: 4,
                      }}
                      title="Delete Location"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLocs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: COLORS.muted }}>
                    No railway locations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
              background: "transparent", color: COLORS.white, cursor: "pointer", fontSize: 13,
            }}
          >
            Close
          </button>
        </div>
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

function AssetDetailsDrawer({ COLORS, asset, onClose, onEdit, onDecommission }) {
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

              {asset.status !== "DECOMMISSIONED" ? (
                <button
                  onClick={onDecommission}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px", borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.3)",
                    background: "rgba(239, 68, 68, 0.08)", color: "#EF4444", cursor: "pointer", fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <Archive size={14} /> Decommission Unit (Archive)
                </button>
              ) : (
                <div
                  style={{
                    textAlign: "center", padding: "8px", borderRadius: 8,
                    background: "rgba(148, 163, 184, 0.1)", color: "#94A3B8", fontSize: 12,
                  }}
                >
                  ✓ Unit Decommissioned & Withdrawn from Service
                </div>
              )}
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
                        {row.temperature != null ? `${row.temperature}°C` : "—"} · {row.pressure != null ? `${row.pressure} bar` : "—"} · {row.current != null ? `${row.current} A` : "—"}
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
