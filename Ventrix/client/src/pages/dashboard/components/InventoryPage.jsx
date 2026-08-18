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

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [partsRes, catRes] = await Promise.all([
        inventoryService.listParts(),
        inventoryService.listCategories().catch(() => ({ success: false })),
      ]);

      if (partsRes.success) {
        setParts(partsRes.data || []);
      } else {
        setError(partsRes.message || "Failed to load inventory parts.");
      }

      if (catRes.success) {
        setCategories(catRes.data || []);
      }
    } catch {
      setError("Could not reach backend inventory service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdjust(part, type) {
    setAdjustPart(part);
    setAdjustType(type);
    setAdjustQty("");
    setAdjustLocation("Main Warehouse");
    setAdjustError(null);
  }

  async function submitAdjust(e) {
    e.preventDefault();
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) {
      setAdjustError("Please enter a valid positive quantity.");
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
