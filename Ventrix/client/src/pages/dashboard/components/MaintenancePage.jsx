import React, { useState, useEffect } from "react";
import { Plus, X, Wrench, Package, Check, AlertCircle, CheckCircle2, User } from "lucide-react";
import Button from "../../../components/common/Button";
import { maintenanceService } from "../../../services/maintenanceService";
import { getAssets } from "../../../services/assetService";
import { inventoryService } from "../../../services/inventoryService";
import { userService } from "../../../services/userService";
import { useAuth } from "../../../context/AuthContext";

const WO_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "COMPLETED",
  "CLOSED",
];

const STATUS_COLOR = {
  OPEN: { c: "#94A3B8", bg: "rgba(148, 163, 184, 0.12)" },
  ASSIGNED: { c: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
  IN_PROGRESS: { c: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)" },
  WAITING_FOR_PARTS: { c: "#EC4899", bg: "rgba(236, 72, 153, 0.12)" },
  COMPLETED: { c: "#10B981", bg: "rgba(16, 185, 129, 0.12)" },
  CLOSED: { c: "#64748B", bg: "rgba(100, 116, 139, 0.12)" },
};

export default function MaintenancePage({ COLORS, Card, role }) {
  const { can, isVentrixRole } = useAuth();
  const canManage = can("maintenance.manage");

  const [workOrders, setWorkOrders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [inventoryParts, setInventoryParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // New Work Order Modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    asset_id: "",
    title: "",
    description: "",
    priority: "MEDIUM",
    assigned_to: "",
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Use Part Modal
  const [partModalWO, setPartModalWO] = useState(null);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [woParts, setWoParts] = useState([]);
  const [issuingPart, setIssuingPart] = useState(false);

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [woRes, aRes, invRes, uRes] = await Promise.all([
        maintenanceService.listWorkOrders(),
        getAssets(),
        inventoryService.list().catch(() => ({ success: false })),
        userService.getTechnicians().catch(() => ({ success: false })),
      ]);

      if (woRes.success) setWorkOrders(woRes.data || []);
      else setError(woRes.message || "Failed to load work orders.");

      if (aRes.success) setAssets(aRes.data || []);
      if (invRes.success) setInventoryParts(invRes.data || []);
      if (uRes.success && Array.isArray(uRes.data)) {
        setTechnicians(uRes.data);
      }
    } catch {
      setError("Could not reach backend services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitNewWorkOrder(e) {
    e.preventDefault();
    if (!form.asset_id || !form.title) {
      setFormError("Asset and title are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await maintenanceService.createWorkOrder({
        asset_id: Number(form.asset_id),
        title: form.title,
        description: form.description,
        priority: form.priority,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
      });

      if (!res.success) {
        setFormError(res.message);
        return;
      }

      notify("success", `Work Order #${res.data.id} created successfully.`);
      setShowForm(false);
      setForm({ asset_id: "", title: "", description: "", priority: "MEDIUM", assigned_to: "" });
      loadData();
    } catch {
      setFormError("Failed to create work order.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id, status) {
    try {
      const res = await maintenanceService.updateWorkOrderStatus(id, status);
      if (res.success) {
        setWorkOrders((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
        notify("success", `Status updated to ${status}.`);
      } else {
        notify("error", res.message || "Failed to update status.");
      }
    } catch {
      notify("error", "Error updating status.");
    }
  }

  async function openPartUsageModal(wo) {
    setPartModalWO(wo);
    setSelectedPartId(inventoryParts[0]?.id ? String(inventoryParts[0].id) : "");
    setPartQty(1);
    try {
      const res = await maintenanceService.getWorkOrderParts(wo.id);
      if (res.success) setWoParts(res.data || []);
    } catch {
      setWoParts([]);
    }
  }

  async function handleUsePartSubmit(e) {
    e.preventDefault();
    if (!selectedPartId || partQty <= 0) {
      notify("error", "Valid part and quantity required");
      return;
    }
    setIssuingPart(true);
    try {
      const res = await maintenanceService.usePart(partModalWO.id, {
        part_id: Number(selectedPartId),
        quantity: Number(partQty),
      });

      if (res.success) {
        notify("success", "Part deducted from inventory and logged on work order.");
        const partsRes = await maintenanceService.getWorkOrderParts(partModalWO.id);
        if (partsRes.success) setWoParts(partsRes.data || []);
        // Refresh inventory counts
        const invRes = await inventoryService.list();
        if (invRes.success) setInventoryParts(invRes.data || []);
      } else {
        notify("error", res.message || "Failed to issue part.");
      }
    } catch {
      notify("error", "Failed to issue part.");
    } finally {
      setIssuingPart(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toast Notification */}
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
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#EF4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Maintenance & Work Orders
          </h2>
          <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>
            Assign technicians, track state machine workflows, and issue depot spare parts
          </div>
        </div>

        {canManage && (
          <Button variant="glow" size="sm" icon={Plus} onClick={() => setShowForm(true)}>
            New Work Order
          </Button>
        )}
      </div>

      {/* Work Orders Table */}
      <Card hoverEffect={false}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94A3B8", fontSize: 11.5, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={{ padding: "10px 8px" }}>ID & Title</th>
                <th style={{ padding: "10px 8px" }}>Asset Code</th>
                <th style={{ padding: "10px 8px" }}>Assigned Technician</th>
                <th style={{ padding: "10px 8px" }}>Priority</th>
                <th style={{ padding: "10px 8px" }}>Status Transition</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Parts</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((w) => {
                const statusMeta = STATUS_COLOR[w.status] || STATUS_COLOR.OPEN;

                return (
                  <tr key={w.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ fontWeight: 600 }}>#{w.id} — {w.title}</div>
                      {w.description && (
                        <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>{w.description}</div>
                      )}
                    </td>

                    <td style={{ padding: "12px 8px", fontFamily: "'JetBrains Mono', monospace", color: "#06B6D4" }}>
                      {w.asset_code || `Asset #${w.asset_id}`}
                    </td>

                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <User size={13} color="#94A3B8" />
                        <span>{w.assigned_to_name || "Unassigned"}</span>
                      </div>
                    </td>

                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          padding: "2px 7px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          color: w.priority === "HIGH" || w.priority === "CRITICAL" ? "#EF4444" : "#F59E0B",
                          background: w.priority === "HIGH" || w.priority === "CRITICAL" ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                        }}
                      >
                        {w.priority || "MEDIUM"}
                      </span>
                    </td>

                    <td style={{ padding: "12px 8px" }}>
                      {canManage ? (
                        <select
                          value={w.status}
                          onChange={(e) => changeStatus(w.id, e.target.value)}
                          style={{
                            background: statusMeta.bg,
                            color: statusMeta.c,
                            border: `1px solid ${statusMeta.c}44`,
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 12,
                            fontWeight: 600,
                            outline: "none",
                            cursor: "pointer",
                          }}
                        >
                          {WO_STATUSES.map((s) => (
                            <option key={s} value={s} style={{ background: "#131C31", color: "#fff" }}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ padding: "3px 8px", borderRadius: 6, color: statusMeta.c, background: statusMeta.bg, fontSize: 11.5, fontWeight: 600 }}>
                          {w.status}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "12px 8px", textAlign: "right" }}>
                      <button
                        onClick={() => openPartUsageModal(w)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          padding: "5px 9px",
                          color: "#06B6D4",
                          fontSize: 12,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Package size={13} /> Manage Parts
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!loading && workOrders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "36px 0", textAlign: "center", color: "#94A3B8" }}>
                    No work orders logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Work Order Modal */}
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
              maxWidth: 520,
              background: "#131C31",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Create Maintenance Work Order</div>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 6, background: "rgba(239, 68, 68, 0.12)", color: "#EF4444", fontSize: 12.5, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <form onSubmit={submitNewWorkOrder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Target HVAC Asset</label>
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
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Work Order Title</label>
                <input
                  type="text"
                  placeholder="e.g. Compressor 500h Turnaround Service"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Assign Technician</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                  >
                    <option value="">Unassigned</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>{tech.name} ({tech.role_name})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Task scope and instructions..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 14px", color: "#94A3B8", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ background: "#06B6D4", border: "none", borderRadius: 6, padding: "7px 16px", color: "#000", fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Creating..." : "Create Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Use Spare Part Modal */}
      {partModalWO && (
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
              maxWidth: 550,
              background: "#131C31",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Package size={18} color="#06B6D4" />
                Spare Parts — Work Order #{partModalWO.id}
              </div>
              <button onClick={() => setPartModalWO(null)} style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {/* Issued Parts List */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 8 }}>Parts Issued to this Job:</div>
              <div style={{ background: "#0B1120", borderRadius: 8, padding: 10, border: "1px solid rgba(255,255,255,0.06)", maxHeight: 130, overflowY: "auto" }}>
                {woParts.map((wp) => (
                  <div key={wp.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span>{wp.part_name || wp.name || wp.part_code || `Part #${wp.part_id}`}</span>
                    <strong style={{ color: "#10B981" }}>× {wp.quantity} {wp.unit_of_measure || wp.unit || "pcs"}</strong>
                  </div>
                ))}
                {woParts.length === 0 && (
                  <div style={{ color: "#94A3B8", fontSize: 12, textAlign: "center", padding: "8px 0" }}>No parts issued yet.</div>
                )}
              </div>
            </div>

            {/* Issue Part Form */}
            {canManage && (
              <form onSubmit={handleUsePartSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#06B6D4" }}>Issue Part from Depot Inventory:</div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 3 }}>Select Spare Part</label>
                    <select
                      value={selectedPartId}
                      onChange={(e) => setSelectedPartId(e.target.value)}
                      style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", color: "inherit", fontSize: 12.5 }}
                      required
                    >
                      <option value="">Select Part</option>
                      {inventoryParts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name || item.part_name} ({item.part_code}) — Avail: {item.total_quantity ?? item.quantity ?? 0} {item.unit || "pcs"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 3 }}>Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={partQty}
                      onChange={(e) => setPartQty(e.target.value)}
                      style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", color: "inherit", fontSize: 12.5 }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                  <button
                    type="submit"
                    disabled={issuingPart}
                    style={{
                      background: "#10B981",
                      border: "none",
                      borderRadius: 6,
                      padding: "7px 16px",
                      color: "#000",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    {issuingPart ? "Deducting..." : "Issue Part (Deduct Stock)"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
