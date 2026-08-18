import React, { useState, useEffect } from "react";
import { Plus, X, Wrench, CheckCircle2, AlertCircle, RotateCw, Send } from "lucide-react";
import Button from "../../../components/common/Button";
import { serviceRequestService } from "../../../services/serviceRequestService";
import { maintenanceService } from "../../../services/maintenanceService";
import { getAssets } from "../../../services/assetService";
import { useAuth } from "../../../context/AuthContext";

const STATUS_COLOR = {
  OPEN: { c: "#94A3B8", bg: "rgba(148, 163, 184, 0.12)" },
  ASSIGNED: { c: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
  IN_PROGRESS: { c: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)" },
  RESOLVED: { c: "#10B981", bg: "rgba(16, 185, 129, 0.12)" },
  CLOSED: { c: "#64748B", bg: "rgba(100, 116, 139, 0.12)" },
};

const STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const VENTRIX_ROLES = ["SUPER_ADMIN", "VENTRIX_ADMIN", "ENGINEER", "TECHNICIAN"];

export default function ServiceRequestsPage({ COLORS, Card }) {
  const { role, isVentrixRole } = useAuth();
  const canResolve = VENTRIX_ROLES.includes(role);

  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // New Service Request Modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ asset_id: "", title: "", description: "", priority: "MEDIUM" });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Escalation
  const [escalatingId, setEscalatingId] = useState(null);

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function load() {
    setLoading(true);
    try {
      const [rRes, aRes] = await Promise.all([serviceRequestService.list(), getAssets()]);
      if (rRes.success) setRequests(rRes.data || []);
      else setError(rRes.message);
      if (aRes.success) setAssets(aRes.data || []);
    } catch {
      setError("Could not reach backend services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.asset_id || !form.title) {
      setFormError("Asset and title are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await serviceRequestService.create({
        asset_id: Number(form.asset_id),
        title: form.title,
        description: form.description,
        priority: form.priority,
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      notify("success", "Service request submitted to Ventrix engineering.");
      setShowForm(false);
      setForm({ asset_id: "", title: "", description: "", priority: "MEDIUM" });
      await load();
    } catch {
      setFormError("Could not reach backend services.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id, status) {
    try {
      const res = await serviceRequestService.updateStatus(id, status);
      if (res.success) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        notify("success", `Ticket status updated to ${status}.`);
      } else {
        notify("error", res.message || "Failed to update status.");
      }
    } catch {
      notify("error", "Failed to update status.");
    }
  }

  async function escalateToWorkOrder(req) {
    setEscalatingId(req.id);
    try {
      const res = await maintenanceService.createWorkOrder({
        asset_id: req.asset_id,
        title: `[Service Ticket #${req.id}] ${req.title}`,
        description: req.description || "Escalated from customer service request",
        priority: req.priority || "HIGH",
        service_request_id: req.id,
        status: "OPEN",
      });

      if (res.success) {
        notify("success", `Work Order #${res.data.id} created and linked to ticket #${req.id}.`);
        await load();
      } else {
        notify("error", res.message || "Failed to escalate ticket.");
      }
    } catch {
      notify("error", "Error creating work order.");
    } finally {
      setEscalatingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            padding: "12px 20px",
            borderRadius: 10,
            background: toast.type === "success" ? "#064E3B" : "#7F1D1D",
            border: `1px solid ${toast.type === "success" ? "#10B981" : "#EF4444"}`,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            fontSize: 13.5,
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} color="#34D399" /> : <AlertCircle size={18} color="#F87171" />}
          {toast.message}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: `${COLORS.danger}19`, border: `1px solid ${COLORS.danger}55`, color: COLORS.danger, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Customer Service Requests</h2>
          <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>
            Submit tickets for anomalous cooling, noise, or physical faults and escalate directly to maintenance
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" size="sm" icon={RotateCw} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="glow" size="sm" icon={Plus} onClick={() => setShowForm(true)}>
            Raise Request
          </Button>
        </div>
      </div>

      <Card hoverEffect={false}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94A3B8", fontSize: 11.5, borderBottom: `1px solid ${COLORS.border}` }}>
                <th style={{ padding: "10px 8px" }}>Ticket ID & Issue</th>
                <th style={{ padding: "10px 8px" }}>Target HVAC Unit</th>
                {isVentrixRole && <th style={{ padding: "10px 8px" }}>Customer Org</th>}
                <th style={{ padding: "10px 8px" }}>Priority</th>
                <th style={{ padding: "10px 8px" }}>Status</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const meta = STATUS_COLOR[r.status] || STATUS_COLOR.OPEN;

                return (
                  <tr key={r.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ fontWeight: 600 }}>#{r.id} — {r.title}</div>
                      {r.description && <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>{r.description}</div>}
                    </td>

                    <td style={{ padding: "12px 8px", fontFamily: "'JetBrains Mono', monospace", color: "#06B6D4" }}>
                      {r.asset_code || `Asset #${r.asset_id}`}
                    </td>

                    {isVentrixRole && (
                      <td style={{ padding: "12px 8px", color: "#CBD5E1" }}>
                        {r.organization_name || "Customer Depot"}
                      </td>
                    )}

                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          color: r.priority === "HIGH" || r.priority === "CRITICAL" ? "#EF4444" : "#F59E0B",
                          background: r.priority === "HIGH" || r.priority === "CRITICAL" ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                        }}
                      >
                        {r.priority || "MEDIUM"}
                      </span>
                    </td>

                    <td style={{ padding: "12px 8px" }}>
                      {canResolve ? (
                        <select
                          value={r.status}
                          onChange={(e) => changeStatus(r.id, e.target.value)}
                          style={{
                            background: meta.bg,
                            color: meta.c,
                            border: `1px solid ${meta.c}44`,
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 12,
                            fontWeight: 600,
                            outline: "none",
                            cursor: "pointer",
                          }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} style={{ background: "#131C31", color: "#fff" }}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ padding: "3px 8px", borderRadius: 6, color: meta.c, background: meta.bg, fontSize: 11.5, fontWeight: 600 }}>
                          {r.status}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                      {canResolve && r.status !== "RESOLVED" && r.status !== "CLOSED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={escalatingId === r.id}
                          onClick={() => escalateToWorkOrder(r)}
                          icon={Wrench}
                        >
                          {escalatingId === r.id ? "Escalating..." : "Escalate to Work Order"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 8px", textAlign: "center", color: "#94A3B8" }}>
                    No service requests logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Request Modal */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: "#131C31",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Submit Customer Service Ticket</div>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 6, background: "rgba(239, 68, 68, 0.12)", color: "#EF4444", fontSize: 12.5, marginBottom: 12 }}>
                {formError}
              </div>
            )}

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Affected HVAC Unit</label>
                <select
                  value={form.asset_id}
                  onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                  style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                  required
                >
                  <option value="">Select Asset</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.asset_code} — {a.name || "HVAC Unit"}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Issue Summary / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Inadequate cooling in Coach B1"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                >
                  <option value="CRITICAL">Critical (Train Departure Affected)</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Detailed Observations</label>
                <textarea
                  rows={3}
                  placeholder="Describe sensor symptoms, cabin temperatures, or error codes..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 14px", color: "#94A3B8", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ background: "#06B6D4", border: "none", borderRadius: 6, padding: "7px 16px", color: "#000", fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
