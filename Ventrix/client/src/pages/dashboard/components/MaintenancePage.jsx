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
  "ACCEPTED",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "PARTS_ISSUED",
  "COMPLETED",
  "UNDER_VERIFICATION",
  "CLOSED",
];

const STATUS_COLOR = {
  OPEN: { c: "#94A3B8", bg: "rgba(148, 163, 184, 0.12)" },
  ASSIGNED: { c: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
  ACCEPTED: { c: "#3B82F6", bg: "rgba(59, 130, 246, 0.12)" },
  IN_PROGRESS: { c: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)" },
  WAITING_FOR_PARTS: { c: "#EC4899", bg: "rgba(236, 72, 153, 0.12)" },
  PARTS_ISSUED: { c: "#8B5CF6", bg: "rgba(139, 92, 246, 0.12)" },
  COMPLETED: { c: "#10B981", bg: "rgba(16, 185, 129, 0.12)" },
  UNDER_VERIFICATION: { c: "#C084FC", bg: "rgba(192, 132, 252, 0.15)" },
  CLOSED: { c: "#64748B", bg: "rgba(100, 116, 139, 0.12)" },
};

export default function MaintenancePage({ COLORS, Card, role }) {
  const { user, can, isVentrixRole } = useAuth();
  const canManage = can("maintenance.manage");
  const canVerify = can("maintenance.verify") || user?.role === "ENGINEER" || user?.role === "ADMIN" || user?.role === "VENTRIX_ADMIN";
  const isTechnician = user?.role === "TECHNICIAN" || user?.role_name === "TECHNICIAN" || role === "TECHNICIAN";
  const canApprove = user?.role === "ADMIN" || user?.role === "VENTRIX_ADMIN" || user?.role === "ENGINEER" || can("inventory.manage");

  const [workOrders, setWorkOrders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [inventoryParts, setInventoryParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Verification modal state
  const [verifyWO, setVerifyWO] = useState(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  // New Work Order Modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    asset_id: "",
    title: "",
    description: "",
    priority: "MEDIUM",
    maintenance_type: "CORRECTIVE",
    estimated_duration: "2",
    assigned_to: "",
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Use / Request Part Modal
  const [partModalWO, setPartModalWO] = useState(null);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partUrgency, setPartUrgency] = useState("MEDIUM");
  const [partReason, setPartReason] = useState("");
  const [woParts, setWoParts] = useState([]);
  const [woRequests, setWoRequests] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [issuingPart, setIssuingPart] = useState(false);
  const [approvingReqId, setApprovingReqId] = useState(null);

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [woRes, aRes, invRes, uRes, reqsRes] = await Promise.all([
        maintenanceService.listWorkOrders(),
        getAssets(),
        inventoryService.list().catch(() => ({ success: false })),
        userService.getTechnicians().catch(() => ({ success: false })),
        inventoryService.listRequests({ all: true }).catch(() => ({ success: false })),
      ]);

      if (woRes.success) setWorkOrders(woRes.data || []);
      else setError(woRes.message || "Failed to load work orders.");

      if (aRes.success) setAssets(aRes.data || []);
      if (invRes.success) setInventoryParts(invRes.data || []);
      if (uRes.success && Array.isArray(uRes.data)) {
        setTechnicians(uRes.data);
      }
      if (reqsRes.success && Array.isArray(reqsRes.data)) {
        setPartRequests(reqsRes.data);
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
        maintenance_type: form.maintenance_type || "CORRECTIVE",
        estimated_duration: form.estimated_duration ? Number(form.estimated_duration) : undefined,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
      });

      if (!res.success) {
        setFormError(res.message);
        return;
      }

      notify("success", `Work Order #${res.data.id} created successfully.`);
      setShowForm(false);
      setForm({ asset_id: "", title: "", description: "", priority: "MEDIUM", maintenance_type: "CORRECTIVE", estimated_duration: "2", assigned_to: "" });
      loadData();
    } catch {
      setFormError("Failed to create work order.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyAndClose(woId) {
    setVerifying(true);
    try {
      const res = await maintenanceService.verifyAndCloseWorkOrder(woId, {
        notes: verifyNotes || "Verified compliant with railway HVAC standards.",
      });
      if (res?.success) {
        notify("success", `Work Order #${woId} verified & closed by engineering ✓`);
        setVerifyWO(null);
        setVerifyNotes("");
        loadData();
      } else {
        notify("error", res?.message || "Failed to verify work order.");
      }
    } catch {
      notify("error", "Error during verification.");
    } finally {
      setVerifying(false);
    }
  }

  async function changeStatus(id, status) {
    if (status === "COMPLETED" || status === "CLOSED") {
      // Prevent completion if any requested spare part is still awaiting approval
      const pendingReqs = partRequests.filter(
        (r) => Number(r.work_order_id) === Number(id) && r.status === "PENDING"
      );
      if (pendingReqs.length > 0) {
        notify(
          "error",
          `Cannot complete work order #${id}: ${pendingReqs.length} spare part request(s) are awaiting Admin/Engineer approval.`
        );
        return;
      }
    }

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
    setPartUrgency("MEDIUM");
    setPartReason("");
    try {
      const [partsRes, reqsRes] = await Promise.all([
        maintenanceService.getWorkOrderParts(wo.id).catch(() => ({ success: false })),
        inventoryService.listRequests({ work_order_id: wo.id, all: true }).catch(() => ({ success: false })),
      ]);
      if (partsRes.success) setWoParts(partsRes.data || []);
      else setWoParts([]);

      if (reqsRes.success) setWoRequests(reqsRes.data || []);
      else setWoRequests([]);
    } catch {
      setWoParts([]);
      setWoRequests([]);
    }
  }

  // Technician Submits Spare Part Request (Pending Admin Approval)
  async function handleRequestPartSubmit(e) {
    e.preventDefault();
    if (!selectedPartId || partQty <= 0) {
      notify("error", "Valid part and quantity required");
      return;
    }
    setIssuingPart(true);
    try {
      const res = await inventoryService.createRequest({
        part_id: Number(selectedPartId),
        quantity: Number(partQty),
        work_order_id: partModalWO.id,
        urgency: partUrgency,
        reason: partReason || `Spare part for job #${partModalWO.id}`,
      });

      if (res.success) {
        notify("success", "Spare part requested. Awaiting Admin/Engineer approval before stock is issued.");
        const reqsRes = await inventoryService.listRequests({ work_order_id: partModalWO.id, all: true });
        if (reqsRes.success) setWoRequests(reqsRes.data || []);
        loadData();
      } else {
        notify("error", res.message || "Failed to request part.");
      }
    } catch {
      notify("error", "Failed to request part.");
    } finally {
      setIssuingPart(false);
    }
  }

  // Admin/Engineer Approves Request & Deducts Stock
  async function handleApprovePartRequest(req) {
    setApprovingReqId(req.id);
    try {
      const res = await inventoryService.approveRequest(req.id);
      if (res.success) {
        notify("success", `Approved ${req.quantity}x ${req.part_name}. Stock deducted and issued to work order.`);
        const [partsRes, reqsRes] = await Promise.all([
          maintenanceService.getWorkOrderParts(partModalWO.id),
          inventoryService.listRequests({ work_order_id: partModalWO.id, all: true }),
        ]);
        if (partsRes.success) setWoParts(partsRes.data || []);
        if (reqsRes.success) setWoRequests(reqsRes.data || []);
        loadData();
      } else {
        notify("error", res.message || "Failed to approve request.");
      }
    } catch {
      notify("error", "Error approving request.");
    } finally {
      setApprovingReqId(null);
    }
  }

  // Admin/Engineer Rejects Request
  async function handleRejectPartRequest(req) {
    try {
      const res = await inventoryService.rejectRequest(req.id, {
        rejection_reason: "Rejected by supervisor",
      });
      if (res.success) {
        notify("success", `Request for ${req.quantity}x ${req.part_name} rejected.`);
        const reqsRes = await inventoryService.listRequests({ work_order_id: partModalWO.id, all: true });
        if (reqsRes.success) setWoRequests(reqsRes.data || []);
        loadData();
      } else {
        notify("error", res.message || "Failed to reject request.");
      }
    } catch {
      notify("error", "Error rejecting request.");
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
                <th style={{ padding: "10px 8px" }}>Type</th>
                <th style={{ padding: "10px 8px" }}>Assigned Technician</th>
                <th style={{ padding: "10px 8px" }}>Priority</th>
                <th style={{ padding: "10px 8px" }}>Status Transition</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((w) => {
                const statusMeta = STATUS_COLOR[w.status] || STATUS_COLOR.OPEN;
                const mType = w.maintenance_type || "CORRECTIVE";
                const typeColor = mType === "EMERGENCY" ? "#EF4444" : mType === "PREVENTIVE" ? "#10B981" : "#06B6D4";

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
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          color: typeColor,
                          background: `${typeColor}18`,
                          border: `1px solid ${typeColor}33`,
                        }}
                      >
                        {mType}
                      </span>
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
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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

                        {canVerify && (w.status === "UNDER_VERIFICATION" || (w.status === "COMPLETED" && !w.verified_by)) && (
                          <button
                            onClick={() => {
                              setVerifyWO(w);
                              setVerifyNotes("");
                            }}
                            title="Review technician report and officially sign off"
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              background: "#8B5CF6",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Sign Off ✓
                          </button>
                        )}
                      </div>
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
                  <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Maintenance Type</label>
                  <select
                    value={form.maintenance_type}
                    onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
                    style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                  >
                    <option value="CORRECTIVE">Corrective (Repair)</option>
                    <option value="PREVENTIVE">Preventive (Routine)</option>
                    <option value="EMERGENCY">Emergency (Line Stop)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Estimated Duration (Hrs)</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={form.estimated_duration}
                    onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })}
                    style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                  />
                </div>
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

      {/* Verify & Close Work Order Modal */}
      {verifyWO && (
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
          onClick={() => setVerifyWO(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 540,
              background: "#131C31",
              border: "1.5px solid rgba(168, 85, 247, 0.4)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#C084FC" }}>
                Supervisory Verification & Sign-Off
              </div>
              <button onClick={() => setVerifyWO(null)} style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 8, background: "#0B1120", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontWeight: 600 }}>Work Order #{verifyWO.id} — {verifyWO.title}</div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>
                  Asset: <span style={{ color: "#06B6D4" }}>{verifyWO.asset_code || `Asset #${verifyWO.asset_id}`}</span> · Tech: <span>{verifyWO.assigned_to_name || "Field Technician"}</span>
                </div>
              </div>

              {verifyWO.completion_report && (
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#10B981", textTransform: "uppercase", marginBottom: 4 }}>
                    Technician Physical Completion Report
                  </div>
                  <div style={{ fontSize: 12.5, color: "#E2E8F0", whiteSpace: "pre-wrap" }}>
                    {typeof verifyWO.completion_report === "string"
                      ? verifyWO.completion_report
                      : (verifyWO.completion_report?.summary || verifyWO.completion_report?.action_taken || verifyWO.completion_report?.technician_notes || "Work completed and verified by technician.")}
                  </div>
                  {Array.isArray(verifyWO.completion_report?.findings) && verifyWO.completion_report.findings.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(16, 185, 129, 0.2)" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#06B6D4", marginBottom: 4 }}>Recorded Findings & Readings:</div>
                      {verifyWO.completion_report.findings.map((f, idx) => (
                        <div key={idx} style={{ fontSize: 11.5, color: "#CBD5E1" }}>
                          • {typeof f === "string" ? f : `${f.parameter || "Reading"}: ${f.value || f.finding || ""}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Engineering Verification Notes & Safety Clearance *
                <textarea
                  rows={3}
                  placeholder="Record verification inspection, test bench findings, and official closure approval..."
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13, fontFamily: "inherit" }}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setVerifyWO(null)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 14px", color: "#94A3B8", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={() => handleVerifyAndClose(verifyWO.id)}
                  disabled={verifying}
                  style={{ background: "#8B5CF6", border: "none", borderRadius: 6, padding: "7px 18px", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  {verifying ? "Closing..." : "Verify & Officially Close"}
                </button>
              </div>
            </div>
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
              <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
                <Package size={18} color="#06B6D4" />
                Spare Parts — Work Order #{partModalWO.id}
              </div>
              <button onClick={() => setPartModalWO(null)} style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {/* Requisitions & Issued Parts List */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 8 }}>
                Spare Part Requisitions for this Work Order:
              </div>
              <div style={{ background: "#0B1120", borderRadius: 8, padding: 10, border: "1px solid rgba(255,255,255,0.06)", maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {woRequests.map((req) => {
                  const isPending = req.status === "PENDING";
                  const isApproved = req.status === "APPROVED";
                  const isRejected = req.status === "REJECTED";

                  return (
                    <div
                      key={req.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12.5,
                        padding: "8px 10px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: "#fff" }}>
                          {req.quantity}x {req.part_name || req.name} ({req.part_code || "SKU"})
                        </div>
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                          {req.reason ? `"${req.reason}"` : "Requisitioned for job"} · <span style={{ color: "#06B6D4" }}>{req.urgency}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            color: isApproved ? "#10B981" : isRejected ? "#EF4444" : "#F59E0B",
                            background: isApproved ? "rgba(16,185,129,0.15)" : isRejected ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                          }}
                        >
                          {isApproved ? "🟢 Approved & Issued" : isRejected ? "🔴 Rejected" : "🟡 Pending Admin Approval"}
                        </span>

                        {isPending && canApprove && (
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              disabled={approvingReqId === req.id}
                              onClick={() => handleApprovePartRequest(req)}
                              style={{
                                background: "#10B981",
                                border: "none",
                                borderRadius: 4,
                                padding: "4px 10px",
                                color: "#000",
                                fontWeight: 700,
                                fontSize: 11.5,
                                cursor: "pointer",
                              }}
                            >
                              {approvingReqId === req.id ? "Deducting..." : "Approve & Issue"}
                            </button>

                            <button
                              onClick={() => handleRejectPartRequest(req)}
                              style={{
                                background: "rgba(239, 68, 68, 0.15)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: 4,
                                padding: "4px 8px",
                                color: "#EF4444",
                                fontWeight: 700,
                                fontSize: 11.5,
                                cursor: "pointer",
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {woRequests.length === 0 && woParts.length === 0 && (
                  <div style={{ color: "#94A3B8", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
                    No spare parts requested or issued yet for this work order.
                  </div>
                )}
              </div>
            </div>

            {/* Request Spare Part Form (Only for Field Technicians) */}
            {isTechnician ? (
              <form onSubmit={handleRequestPartSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#06B6D4" }}>
                    Request Spare Part Requisition:
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>
                    Requires Admin/Engineer approval before stock is deducted & issued.
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 3 }}>Select Spare Part *</label>
                    <select
                      value={selectedPartId}
                      onChange={(e) => setSelectedPartId(e.target.value)}
                      style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", color: "inherit", fontSize: 12.5 }}
                      required
                    >
                      <option value="">Select Part from Warehouse...</option>
                      {inventoryParts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name || item.part_name} ({item.part_code}) — Depot Stock: {item.total_quantity ?? item.quantity ?? 0} {item.unit || "pcs"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 3 }}>Quantity *</label>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 3 }}>Urgency Level</label>
                    <select
                      value={partUrgency}
                      onChange={(e) => setPartUrgency(e.target.value)}
                      style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", color: "inherit", fontSize: 12.5 }}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 3 }}>Reason / Justification</label>
                    <input
                      type="text"
                      placeholder="e.g. Worn contactor detected during inspection"
                      value={partReason}
                      onChange={(e) => setPartReason(e.target.value)}
                      style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 10px", color: "inherit", fontSize: 12.5 }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                  <button
                    type="submit"
                    disabled={issuingPart}
                    style={{
                      background: "#06B6D4",
                      border: "none",
                      borderRadius: 6,
                      padding: "7px 16px",
                      color: "#000",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    {issuingPart ? "Submitting..." : "Submit Spare Part Request"}
                  </button>
                </div>
              </form>
            ) : (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 12,
                  color: "#94A3B8",
                  textAlign: "center",
                  marginTop: 14,
                }}
              >
                ℹ️ Field technicians submit requisitions for this work order. As a Supervisor (Admin / Engineer), review and approve pending requests above to deduct stock and issue parts.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
