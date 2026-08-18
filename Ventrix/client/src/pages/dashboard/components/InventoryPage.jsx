import React, { useState, useEffect } from "react";
import { X, PackagePlus, PackageMinus, AlertTriangle, ArrowRight, RotateCw } from "lucide-react";
import Button from "../../../components/common/Button";
import { inventoryService } from "../../../services/inventoryService";
import { useAuth } from "../../../context/AuthContext";

export default function InventoryPage({ COLORS, Card }) {
  const { can } = useAuth();
  const canManage = can("inventory.manage");

  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [adjustPart, setAdjustPart] = useState(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState("RECEIVED");
  const [adjustError, setAdjustError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await inventoryService.listParts();
      if (res.success) setParts(res.data || []);
      else setError(res.message);
    } catch {
      setError("Could not reach backend services.");
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
    setAdjustError(null);
  }

  async function submitAdjust(e) {
    e.preventDefault();
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) {
      setAdjustError("Enter a positive quantity.");
      return;
    }
    setSaving(true);
    try {
      const res = await inventoryService.adjustStock({
        partId: adjustPart.id,
        location: "Main Warehouse",
        quantityChange: adjustType === "USED" ? -qty : qty,
        transactionType: adjustType,
      });
      if (!res.success) {
        setAdjustError(res.message);
        return;
      }
      setAdjustPart(null);
      await load();
    } catch {
      setAdjustError("Could not reach backend services.");
    } finally {
      setSaving(false);
    }
  }

  const lowStockCount = parts.filter((p) => Number(p.total_stock || 0) <= Number(p.min_stock || 5)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: `${COLORS.danger}19`, border: `1px solid ${COLORS.danger}55`, color: COLORS.danger, fontSize: 13 }}>
          {error}
        </div>
      )}

      {lowStockCount > 0 && (
        <div style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={16} color="#F59E0B" />
          <span style={{ fontSize: 13, color: "#F59E0B" }}>
            <strong>{lowStockCount} part{lowStockCount > 1 ? "s" : ""}</strong> are currently at or below minimum depot threshold.
          </span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Spare Parts Depot Inventory</h2>
          <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 2 }}>
            Track on-hand quantities, consumption in work orders, and restocking thresholds
          </div>
        </div>
        <Button variant="outline" size="sm" icon={RotateCw} onClick={load} disabled={loading}>
          Refresh Stock
        </Button>
      </div>

      <Card hoverEffect={false}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94A3B8", fontSize: 11.5, borderBottom: `1px solid ${COLORS.border}` }}>
                <th style={{ padding: "10px 8px" }}>Part Name & Code</th>
                <th style={{ padding: "10px 8px" }}>Category</th>
                <th style={{ padding: "10px 8px" }}>On Hand</th>
                <th style={{ padding: "10px 8px" }}>Min Threshold</th>
                <th style={{ padding: "10px 8px" }}>Unit Price</th>
                {canManage && <th style={{ padding: "10px 8px", textAlign: "right" }}>Quick Adjust</th>}
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const onHand = Number(p.total_stock != null ? p.total_stock : p.quantity || 0);
                const minStock = Number(p.min_stock || 5);
                const isLow = onHand <= minStock;

                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11.5, color: "#06B6D4", fontFamily: "'JetBrains Mono', monospace" }}>{p.part_code}</div>
                    </td>
                    <td style={{ padding: "12px 8px", color: "#94A3B8" }}>{p.category_name || "HVAC Components"}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: isLow ? "#EF4444" : "#10B981", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 15 }}>
                          {onHand} {p.unit_of_measure || "pcs"}
                        </span>
                        {isLow && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(239, 68, 68, 0.15)", color: "#EF4444" }}>
                            LOW STOCK
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "12px 8px", fontFamily: "'JetBrains Mono', monospace", color: "#94A3B8" }}>
                      {minStock} {p.unit_of_measure || "pcs"}
                    </td>
                    <td style={{ padding: "12px 8px", fontFamily: "'JetBrains Mono', monospace" }}>
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
                              padding: "5px 9px",
                              color: "#10B981",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
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
                              padding: "5px 9px",
                              color: "#EF4444",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
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
              {!loading && parts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 8px", textAlign: "center", color: "#94A3B8" }}>
                    No spare parts registered yet.
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
              maxWidth: 440,
              background: "#131C31",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {adjustType === "RECEIVED" ? "Add Stock" : "Deduct Stock"} — {adjustPart.name}
              </div>
              <button onClick={() => setAdjustPart(null)} style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {adjustError && (
              <div style={{ padding: 10, borderRadius: 6, background: "rgba(239, 68, 68, 0.12)", color: "#EF4444", fontSize: 12.5, marginBottom: 12 }}>
                {adjustError}
              </div>
            )}

            <form onSubmit={submitAdjust} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 4 }}>Quantity to {adjustType === "RECEIVED" ? "Add" : "Deduct"}</label>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 5"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  style={{ width: "100%", background: "#0B1120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "inherit", fontSize: 13 }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setAdjustPart(null)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 14px", color: "#94A3B8", cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ background: adjustType === "RECEIVED" ? "#10B981" : "#EF4444", border: "none", borderRadius: 6, padding: "7px 16px", color: "#000", fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Updating..." : adjustType === "RECEIVED" ? "Confirm Add Stock" : "Confirm Deduct Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
