import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  PackagePlus,
  PackageMinus,
  AlertTriangle,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
} from "lucide-react";
import Button from "../../../components/common/Button";
import { inventoryService } from "../../../services/inventoryService";
import { useAuth } from "../../../context/AuthContext";

const LOCATIONS = [
  "Main Warehouse",
  "Depot Central Store",
  "Maintenance Bay 1",
  "Maintenance Bay 2",
];

export default function InventoryPage({ COLORS, Card }) {
  const { can } = useAuth();
  const canManage = can("inventory.manage");

  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [partRequests, setPartRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("inventory"); // "inventory" | "requests"
  const [requestStatusFilter, setRequestStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Adjust Stock Modal
  const [adjustPart, setAdjustPart] = useState(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustLocation, setAdjustLocation] = useState("Main Warehouse");
  const [adjustType, setAdjustType] = useState("RECEIVED");
  const [adjustError, setAdjustError] = useState(null);
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Register New Part Modal
  const [showNewPartModal, setShowNewPartModal] = useState(false);
  const [newPartForm, setNewPartForm] = useState({
    name: "",
    part_code: "",
    category_id: "",
    unit: "pcs",
    minimum_stock: 5,
    unit_price: "",
    initial_stock: 0,
  });
  const [newPartError, setNewPartError] = useState(null);
  const [savingNewPart, setSavingNewPart] = useState(false);

  // Rejection Modal
  const [rejectModalReq, setRejectModalReq] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [savingReject, setSavingReject] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [issuingId, setIssuingId] = useState(null);
  const [adjustReason, setAdjustReason] = useState("");

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [partsRes, catRes, reqsRes] = await Promise.all([
        inventoryService.listParts(),
        inventoryService.listCategories().catch(() => ({ success: false })),
        inventoryService.listRequests({ all: true }).catch(() => ({ success: false })),
      ]);

      if (partsRes.success) {
        setParts(partsRes.data || []);
      } else {
        setError(partsRes.message || "Failed to load inventory parts.");
      }

      if (catRes.success) {
        setCategories(catRes.data || []);
      }

      if (reqsRes.success) {
        setPartRequests(reqsRes.data || []);
      }
    } catch {
      setError("Could not reach backend inventory service.");
    } finally {
      setLoading(false);
    }
  }

  const handleApproveRequest = async (req) => {
    setApprovingId(req.id);
    try {
      const res = await inventoryService.approveRequest(req.id);
      if (res.success) {
        notify("success", `Approved technical requisition #${req.id} for ${req.quantity}x ${req.part_name}. Ready for warehouse issuance.`);
        await load();
      } else {
        notify("error", res.message || "Failed to approve requisition.");
      }
    } catch (err) {
      notify("error", err?.response?.data?.message || "Error approving request.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleIssueRequest = async (req) => {
    setIssuingId(req.id);
    try {
      const res = await inventoryService.issueRequest(req.id);
      if (res.success) {
        notify("success", `Physically issued ${req.quantity}x ${req.part_name} to Job #${req.work_order_id || "general"}. Depot stock deducted.`);
        await load();
      } else {
        notify("error", res.message || "Failed to issue requisition.");
      }
    } catch (err) {
      notify("error", err?.response?.data?.message || "Error issuing request.");
    } finally {
      setIssuingId(null);
    }
  };

  const handleRejectRequest = async (e) => {
    e.preventDefault();
    if (!rejectModalReq) return;
    setSavingReject(true);
    try {
      const res = await inventoryService.rejectRequest(rejectModalReq.id, {
        rejection_reason: rejectionReason || "Rejected by supervisor",
      });
      if (res.success) {
        notify("success", `Requisition #${rejectModalReq.id} rejected.`);
        setRejectModalReq(null);
        setRejectionReason("");
        await load();
      } else {
        notify("error", res.message || "Failed to reject requisition.");
      }
    } catch {
      notify("error", "Error rejecting request.");
    } finally {
      setSavingReject(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function openAdjust(part, type) {
    setAdjustPart(part);
    setAdjustType(type);
    setAdjustQty("");
    setAdjustLocation("Main Warehouse");
    setAdjustReason("");
    setAdjustError(null);
  }

  async function submitAdjust(e) {
    e.preventDefault();
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) {
      setAdjustError("Please enter a valid positive quantity.");
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError("Mandatory reason is required for auditable inventory stock adjustments.");
      return;
    }
    setSavingAdjust(true);
    setAdjustError(null);
    try {
      const res = await inventoryService.adjustStock({
        partId: adjustPart.id,
        location: adjustLocation || "Main Warehouse",
        quantityChange: adjustType === "USED" ? -qty : qty,
        transactionType: adjustType,
        reason: adjustReason.trim(),
      });

      if (!res.success) {
        setAdjustError(res.message || "Failed to adjust stock.");
        return;
      }

      const actionText = adjustType === "RECEIVED" ? "added to" : "deducted from";
      notify(
        "success",
        `Successfully ${actionText} stock: ${qty} ${adjustPart.unit || "pcs"} for ${adjustPart.name}.`
      );
      setAdjustPart(null);
      setAdjustQty("");
      setAdjustReason("");
      setAdjustError(null);
      await load();
    } catch (err) {
      setAdjustError(err.message || "Could not connect to server.");
    } finally {
      setSavingAdjust(false);
    }
  }

  async function submitNewPart(e) {
    e.preventDefault();
    if (!newPartForm.name || !newPartForm.part_code) {
      setNewPartError("Part name and part code are required.");
      return;
    }

    setSavingNewPart(true);
    setNewPartError(null);

    try {
      const payload = {
        name: newPartForm.name.trim(),
        part_code: newPartForm.part_code.trim().toUpperCase(),
        category_id: newPartForm.category_id ? Number(newPartForm.category_id) : undefined,
        unit: newPartForm.unit || "pcs",
        minimum_stock: Number(newPartForm.minimum_stock) || 0,
        unit_price: newPartForm.unit_price ? Number(newPartForm.unit_price) : 0,
        status: "ACTIVE",
      };

      const res = await inventoryService.createPart(payload);
      if (!res.success) {
        setNewPartError(res.message || "Failed to create part.");
        return;
      }

      const createdPart = res.data;
      const initialQty = Number(newPartForm.initial_stock);

      // If initial stock provided, add stock adjustment transaction
      if (initialQty > 0 && createdPart?.id) {
        await inventoryService.adjustStock({
          partId: createdPart.id,
          location: "Main Warehouse",
          quantityChange: initialQty,
          transactionType: "RECEIVED",
          referenceType: "manual",
        });
      }

      notify("success", `New spare part "${payload.name}" registered successfully.`);
      setShowNewPartModal(false);
      setNewPartForm({
        name: "",
        part_code: "",
        category_id: "",
        unit: "pcs",
        minimum_stock: 5,
        unit_price: "",
        initial_stock: 0,
      });
      await load();
    } catch (err) {
      setNewPartError(err.message || "Failed to create spare part.");
    } finally {
      setSavingNewPart(false);
    }
  }

  const filteredParts = parts.filter((p) => {
    if (selectedCategory !== "ALL" && String(p.category_id) !== String(selectedCategory)) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const matchName = (p.name || "").toLowerCase().includes(q);
      const matchCode = (p.part_code || "").toLowerCase().includes(q);
      const matchCat = (p.category_name || "").toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchCat) return false;
    }
    return true;
  });

  const lowStockCount = parts.filter((p) => {
    const onHand = Number(p.total_quantity ?? p.total_stock ?? p.quantity ?? 0);
    const minStock = Number(p.minimum_stock ?? p.min_stock ?? 5);
    return onHand <= minStock;
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 110,
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
          {toast.type === "success" ? (
            <CheckCircle2 size={18} color="#34D399" />
          ) : (
            <AlertCircle size={18} color="#F87171" />
          )}
          {toast.message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#EF4444",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Low Stock Warning Banner */}
      {lowStockCount > 0 && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertTriangle size={16} color="#F59E0B" />
          <span style={{ fontSize: 13, color: "#F59E0B" }}>
            <strong>
              {lowStockCount} part{lowStockCount > 1 ? "s" : ""}
            </strong>{" "}
            currently at or below minimum depot threshold. Replenish inventory via <strong>+ Add</strong>.
          </span>
        </div>
      )}

      {/* Top View Selector Tabs */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4, marginTop: 4 }}>
        <button
          onClick={() => setActiveTab("inventory")}
          style={{
            padding: "9px 18px",
            borderRadius: "8px 8px 0 0",
            border: "none",
            borderBottom: activeTab === "inventory" ? "2px solid #06B6D4" : "2px solid transparent",
            background: activeTab === "inventory" ? "rgba(6, 182, 212, 0.12)" : "transparent",
            color: activeTab === "inventory" ? "#06B6D4" : "#94A3B8",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Package size={16} />
          Warehouse Stock & Catalog ({parts.length})
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          style={{
            padding: "9px 18px",
            borderRadius: "8px 8px 0 0",
            border: "none",
            borderBottom: activeTab === "requests" ? "2px solid #F59E0B" : "2px solid transparent",
            background: activeTab === "requests" ? "rgba(245, 158, 11, 0.12)" : "transparent",
            color: activeTab === "requests" ? "#F59E0B" : "#94A3B8",
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Layers size={16} />
          Spare Part Requisitions & Approvals
          {partRequests.filter((r) => r.status === "PENDING").length > 0 && (
            <span
              style={{
                background: "#F59E0B",
                color: "#000",
                padding: "2px 7px",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {partRequests.filter((r) => r.status === "PENDING").length} Pending
            </span>
          )}
        </button>
      </div>

      {activeTab === "inventory" ? (
        <>
          {/* Header & Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                Spare Parts Depot Inventory
              </h2>
              <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>
                Track on-hand quantities, replenish depot stock, and manage critical maintenance spares
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button variant="outline" size="sm" icon={RotateCw} onClick={load} disabled={loading}>
                Refresh Stock
              </Button>
              {canManage && (
                <Button
                  variant="glow"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setNewPartError(null);
                    setShowNewPartModal(true);
                  }}
                >
                  New Spare Part
                </Button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#0F172A",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "6px 12px",
                flex: "1 1 240px",
                maxWidth: 360,
              }}
            >
              <Search size={14} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search part name, code, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#fff",
                  fontSize: 13,
                  width: "100%",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94A3B8",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  background: "#0F172A",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "7px 12px",
                  color: "#CBD5E1",
                  fontSize: 12.5,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Parts Table */}
          <Card hoverEffect={false}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      color: "#94A3B8",
                      fontSize: 11.5,
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <th style={{ padding: "10px 8px" }}>Part Name & Code</th>
                    <th style={{ padding: "10px 8px" }}>Category</th>
                    <th style={{ padding: "10px 8px" }}>On Hand</th>
                    <th style={{ padding: "10px 8px" }}>Min Threshold</th>
                    <th style={{ padding: "10px 8px" }}>Unit Price</th>
                    {canManage && (
                      <th style={{ padding: "10px 8px", textAlign: "right" }}>Quick Adjust</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map((p) => {
                    const onHand = Number(p.total_quantity ?? p.total_stock ?? p.quantity ?? 0);
                    const minStock = Number(p.minimum_stock ?? p.min_stock ?? 5);
                    const unit = p.unit || p.unit_of_measure || "pcs";
                    const isLow = onHand <= minStock;

                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                        <td style={{ padding: "12px 8px" }}>
                          <div style={{ fontWeight: 600, color: "#F8FAFC" }}>{p.name}</div>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: "#06B6D4",
                              fontFamily: "'JetBrains Mono', monospace",
                              marginTop: 2,
                            }}
                          >
                            {p.part_code}
                          </div>
                        </td>
                        <td style={{ padding: "12px 8px", color: "#94A3B8" }}>
                          <span
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 11.5,
                            }}
                          >
                            {p.category_name || "General"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                color: isLow ? "#EF4444" : "#10B981",
                                fontWeight: 700,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 15,
                              }}
                            >
                              {onHand} {unit}
                            </span>
                            {isLow && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "#EF4444",
                                }}
                              >
                                LOW STOCK
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "12px 8px",
                            fontFamily: "'JetBrains Mono', monospace",
                            color: "#94A3B8",
                          }}
                        >
                          {minStock} {unit}
                        </td>
                        <td
                          style={{
                            padding: "12px 8px",
                            fontFamily: "'JetBrains Mono', monospace",
                            color: "#CBD5E1",
                          }}
                        >
                          ₹{Number(p.unit_price || 0).toLocaleString()}
                        </td>
                        {canManage && (
                          <td style={{ padding: "12px 8px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <button
                                title="Add Received Stock"
                                onClick={() => openAdjust(p, "RECEIVED")}
                                style={{
                                  background: "rgba(16, 185, 129, 0.12)",
                                  border: "1px solid rgba(16, 185, 129, 0.3)",
                                  borderRadius: 6,
                                  padding: "5px 10px",
                                  color: "#10B981",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <PackagePlus size={13} /> + Add
                              </button>

                              <button
                                title="Deduct Used Stock"
                                onClick={() => openAdjust(p, "USED")}
                                style={{
                                  background: "rgba(239, 68, 68, 0.12)",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  borderRadius: 6,
                                  padding: "5px 10px",
                                  color: "#EF4444",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <PackageMinus size={13} /> - Use
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!loading && filteredParts.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: "36px 8px",
                          textAlign: "center",
                          color: "#94A3B8",
                        }}
                      >
                        {parts.length === 0
                          ? "No spare parts registered yet. Click \"New Spare Part\" to add your first part."
                          : "No spare parts match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        /* ================= SPARE PART REQUISITIONS & APPROVALS QUEUE ================= */
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#fff" }}>
                Spare Parts Requisition & Approval Queue
              </h2>
              <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>
                Review technician part requests. Approving a request atomically deducts stock and issues the component.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Button variant="outline" size="sm" icon={RotateCw} onClick={load} disabled={loading}>
                Refresh Requests
              </Button>
            </div>
          </div>

          {/* Requisition Status Filter Tabs */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => {
              const isSelected = requestStatusFilter === st;
              const count = st === "ALL" ? partRequests.length : partRequests.filter((r) => r.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => setRequestStatusFilter(st)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: isSelected ? "1px solid #06B6D4" : "1px solid rgba(255,255,255,0.08)",
                    background: isSelected ? "rgba(6, 182, 212, 0.15)" : "#0F172A",
                    color: isSelected ? "#06B6D4" : "#94A3B8",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {st === "ALL" ? "All Requisitions" : st.charAt(0) + st.slice(1).toLowerCase()}
                  <span style={{ fontSize: 11, opacity: 0.8 }}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Requisitions Queue Table */}
          <Card hoverEffect={false}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      color: "#94A3B8",
                      fontSize: 11.5,
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <th style={{ padding: "10px 8px" }}>Requested Part</th>
                    <th style={{ padding: "10px 8px" }}>Technician Requester</th>
                    <th style={{ padding: "10px 8px" }}>Qty Needed</th>
                    <th style={{ padding: "10px 8px" }}>Available Stock</th>
                    <th style={{ padding: "10px 8px" }}>Work Order / Job</th>
                    <th style={{ padding: "10px 8px" }}>Urgency</th>
                    <th style={{ padding: "10px 8px" }}>Status</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Supervisor Action</th>
                  </tr>
                </thead>
                <tbody>
                  {partRequests
                    .filter((r) => requestStatusFilter === "ALL" || r.status === requestStatusFilter)
                    .map((req) => {
                      const isPending = req.status === "PENDING";
                      const isApproved = req.status === "APPROVED";
                      const isIssued = req.status === "ISSUED";
                      const isUsed = req.status === "USED";
                      const isRejected = req.status === "REJECTED";
                      const hasEnoughStock = (req.available_stock || 0) >= req.quantity;

                      return (
                        <tr key={req.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                          <td style={{ padding: "12px 8px" }}>
                            <div style={{ fontWeight: 600, color: "#F8FAFC" }}>{req.part_name}</div>
                            <div style={{ fontSize: 11.5, color: "#06B6D4", fontFamily: "'JetBrains Mono', monospace" }}>
                              {req.part_code}
                            </div>
                            {req.reason && (
                              <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>
                                <em>"{req.reason}"</em>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <div style={{ fontWeight: 600, color: "#fff" }}>{req.requester_name || "Field Tech"}</div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>{req.requester_email}</div>
                          </td>
                          <td style={{ padding: "12px 8px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                            {req.quantity} {req.unit_of_measure || "pcs"}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: hasEnoughStock ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                                color: hasEnoughStock ? "#10B981" : "#EF4444",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              {req.available_stock || 0} {req.unit_of_measure || "pcs"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 8px", color: "#94A3B8" }}>
                            {req.work_order_id ? (
                              <div>
                                <span style={{ color: "#06B6D4", fontWeight: 600 }}>#{req.work_order_id}</span> · {req.work_order_title || "Job"}
                                {req.asset_code && <div style={{ fontSize: 11, color: "#64748B" }}>Unit: {req.asset_code}</div>}
                              </div>
                            ) : (
                              "General Depot Maintenance"
                            )}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                color: req.urgency === "CRITICAL" ? "#EF4444" : req.urgency === "HIGH" ? "#F59E0B" : "#10B981",
                                background: req.urgency === "CRITICAL" ? "rgba(239,68,68,0.15)" : req.urgency === "HIGH" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                              }}
                            >
                              {req.urgency}
                            </span>
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: 20,
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: isIssued ? "#10B981" : isApproved ? "#3B82F6" : isUsed ? "#8B5CF6" : isRejected ? "#EF4444" : "#F59E0B",
                                background: isIssued ? "rgba(16,185,129,0.15)" : isApproved ? "rgba(59,130,246,0.15)" : isUsed ? "rgba(139,92,246,0.15)" : isRejected ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                              }}
                            >
                              {isIssued ? "🟢 Issued & Deducted" : isApproved ? "🔵 Approved (Awaiting Issue)" : isUsed ? "🟣 Consumed in Repair" : isRejected ? "🔴 Rejected" : "🟡 Awaiting Approval"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 8px", textAlign: "right" }}>
                            {isPending && canManage ? (
                              <div style={{ display: "inline-flex", gap: 6 }}>
                                <button
                                  disabled={approvingId === req.id}
                                  onClick={() => handleApproveRequest(req)}
                                  title="Approve technical specifications without deducting warehouse stock"
                                  style={{
                                    background: "rgba(59, 130, 246, 0.15)",
                                    border: "1px solid rgba(59, 130, 246, 0.35)",
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    color: "#3B82F6",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <CheckCircle2 size={13} />
                                  {approvingId === req.id ? "Approving..." : "Approve Specs"}
                                </button>

                                <button
                                  onClick={() => {
                                    setRejectModalReq(req);
                                    setRejectionReason("");
                                  }}
                                  style={{
                                    background: "rgba(239, 68, 68, 0.12)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    color: "#EF4444",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <X size={13} />
                                  Reject
                                </button>
                              </div>
                            ) : isApproved && canManage ? (
                              <button
                                disabled={issuingId === req.id || !hasEnoughStock}
                                onClick={() => handleIssueRequest(req)}
                                title={!hasEnoughStock ? "Insufficient warehouse stock to issue" : "Issue part from warehouse and deduct stock"}
                                style={{
                                  background: hasEnoughStock ? "rgba(16, 185, 129, 0.15)" : "rgba(100, 116, 139, 0.15)",
                                  border: `1px solid ${hasEnoughStock ? "rgba(16, 185, 129, 0.35)" : "rgba(100, 116, 139, 0.3)"}`,
                                  borderRadius: 6,
                                  padding: "6px 12px",
                                  color: hasEnoughStock ? "#10B981" : "#64748B",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: hasEnoughStock ? "pointer" : "not-allowed",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Package size={13} />
                                {issuingId === req.id ? "Issuing..." : "Issue from Depot"}
                              </button>
                            ) : (
                              <span style={{ fontSize: 11.5, color: "#64748B" }}>
                                {isIssued ? `Issued by ${req.issuer_name || "Depot"}` : isApproved ? `Approved by ${req.reviewer_name || "Engineer"}` : isRejected ? (req.rejection_reason || "Rejected") : "View Only"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {!loading && partRequests.filter((r) => requestStatusFilter === "ALL" || r.status === requestStatusFilter).length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: "36px 8px", textAlign: "center", color: "#94A3B8" }}>
                        No spare part requisitions found for status "{requestStatusFilter}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ================= MODAL: REJECT REQUISITION ================= */}
      {rejectModalReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 110,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setRejectModalReq(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#131C31",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
                Reject Requisition #{rejectModalReq.id}
              </div>
              <button
                onClick={() => setRejectModalReq(null)}
                style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 14px 0" }}>
              Provide a reason for rejecting the request for <strong>{rejectModalReq.quantity}x {rejectModalReq.part_name}</strong>. Stock will not be deducted.
            </p>

            <form onSubmit={handleRejectRequest} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <textarea
                required
                rows={3}
                placeholder="e.g. Existing serviceable component located in Bay 1 storage..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{
                  background: "#080E1E",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "#fff",
                  fontSize: 13,
                }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setRejectModalReq(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" size="sm" disabled={savingReject}>
                  {savingReject ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustPart && (
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
              maxWidth: 460,
              background: "#131C31",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {adjustType === "RECEIVED" ? (
                  <PackagePlus size={18} color="#10B981" />
                ) : (
                  <PackageMinus size={18} color="#EF4444" />
                )}
                <span>
                  {adjustType === "RECEIVED" ? "Add Received Stock" : "Deduct Used Stock"}
                </span>
              </div>
              <button
                onClick={() => setAdjustPart(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Part Info Card */}
            <div
              style={{
                background: "#0B1120",
                borderRadius: 8,
                padding: "10px 14px",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{adjustPart.name}</div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "#06B6D4",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {adjustPart.part_code}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>Current On-Hand</div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#10B981",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {Number(adjustPart.total_quantity ?? adjustPart.total_stock ?? adjustPart.quantity ?? 0)}{" "}
                  {adjustPart.unit || "pcs"}
                </div>
              </div>
            </div>

            {adjustError && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#EF4444",
                  fontSize: 12.5,
                  marginBottom: 12,
                }}
              >
                {adjustError}
              </div>
            )}

            <form
              onSubmit={submitAdjust}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div>
                <label
                  style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}
                >
                  Depot Warehouse Location
                </label>
                <select
                  value={adjustLocation}
                  onChange={(e) => setAdjustLocation(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0B1120",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    color: "inherit",
                    fontSize: 13,
                  }}
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}
                >
                  Quantity to {adjustType === "RECEIVED" ? "Add (+)" : "Deduct (-)"} ({adjustPart.unit || "pcs"})
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0B1120",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    color: "inherit",
                    fontSize: 13,
                  }}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label
                  style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}
                >
                  Adjustment Reason & Audit Justification *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Depot monthly audit correction, inbound consignment receipt #PO-882, damaged during transit..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0B1120",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    color: "inherit",
                    fontSize: 13,
                    resize: "vertical",
                  }}
                  required
                />
              </div>

              {/* Calculated Preview */}
              {adjustQty && Number(adjustQty) > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#94A3B8",
                    background: "rgba(255,255,255,0.03)",
                    padding: "8px 12px",
                    borderRadius: 6,
                  }}
                >
                  New Projected Balance:{" "}
                  <strong style={{ color: "#06B6D4" }}>
                    {Math.max(
                      0,
                      Number(adjustPart.total_quantity ?? 0) +
                        (adjustType === "RECEIVED" ? Number(adjustQty) : -Number(adjustQty))
                    )}{" "}
                    {adjustPart.unit || "pcs"}
                  </strong>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setAdjustPart(null)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "7px 14px",
                    color: "#94A3B8",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdjust}
                  style={{
                    background: adjustType === "RECEIVED" ? "#10B981" : "#EF4444",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 18px",
                    color: "#000",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {savingAdjust
                    ? "Updating..."
                    : adjustType === "RECEIVED"
                    ? "Confirm Add Stock"
                    : "Confirm Deduct Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register New Spare Part Modal */}
      {showNewPartModal && (
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
              boxShadow: "0 20px 48px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Package size={18} color="#06B6D4" />
                Register New Spare Part
              </div>
              <button
                onClick={() => setShowNewPartModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {newPartError && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#EF4444",
                  fontSize: 12.5,
                  marginBottom: 12,
                }}
              >
                {newPartError}
              </div>
            )}

            <form
              onSubmit={submitNewPart}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label
                    style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}
                  >
                    Part Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Expansion Valve R134a"
                    value={newPartForm.name}
                    onChange={(e) => setNewPartForm({ ...newPartForm, name: e.target.value })}
                    style={{
                      width: "100%",
                      background: "#0B1120",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "inherit",
                      fontSize: 13,
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}
                  >
                    Part Code / SKU *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VX-VALVE-06"
                    value={newPartForm.part_code}
                    onChange={(e) =>
                      setNewPartForm({ ...newPartForm, part_code: e.target.value.toUpperCase() })
                    }
                    style={{
                      width: "100%",
                      background: "#0B1120",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "inherit",
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label
                    style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}
                  >
                    Category
                  </label>
                  <select
                    value={newPartForm.category_id}
                    onChange={(e) =>
                      setNewPartForm({ ...newPartForm, category_id: e.target.value })
                    }
                    style={{
                      width: "100%",
                      background: "#0B1120",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}
                  >
                    Unit of Measure
                  </label>
                  <select
                    value={newPartForm.unit}
                    onChange={(e) => setNewPartForm({ ...newPartForm, unit: e.target.value })}
                    style={{
                      width: "100%",
                      background: "#0B1120",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="units">Units</option>
                    <option value="meters">Meters</option>
                    <option value="liters">Liters</option>
                    <option value="kg">Kilograms (kg)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label
                    style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 4 }}
                  >
                    Min Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPartForm.minimum_stock}
                    onChange={(e) =>
                      setNewPartForm({ ...newPartForm, minimum_stock: e.target.value })
                    }
                    style={{
                      width: "100%",
                      background: "#0B1120",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 4 }}
                  >
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={newPartForm.unit_price}
                    onChange={(e) =>
                      setNewPartForm({ ...newPartForm, unit_price: e.target.value })
                    }
                    style={{
                      width: "100%",
                      background: "#0B1120",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{ fontSize: 11.5, color: "#94A3B8", display: "block", marginBottom: 4 }}
                  >
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPartForm.initial_stock}
                    onChange={(e) =>
                      setNewPartForm({ ...newPartForm, initial_stock: e.target.value })
                    }
                    style={{
                      width: "100%",
                      background: "#0B1120",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowNewPartModal(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    padding: "7px 14px",
                    color: "#94A3B8",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewPart}
                  style={{
                    background: "#06B6D4",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 18px",
                    color: "#000",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {savingNewPart ? "Registering..." : "Register Spare Part"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
