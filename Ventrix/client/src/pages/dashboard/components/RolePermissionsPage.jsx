import React, { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Layers,
  Sparkles,
  RotateCw,
} from "lucide-react";
import { roleService } from "../../../services/roleService";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";

const COLORS = {
  card: "#111827",
  border: "#1E293B",
  primary: "#06B6D4",
  muted: "#94A3B8",
  white: "#F8FAFC",
  success: "#22C55E",
};

const CATEGORY_ICONS = {
  Monitoring: "📡",
  Assets: "🚆",
  Operations: "⚙️",
  Administration: "🔐",
};

function ToggleSwitch({ checked, disabled, onChange, saving }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || saving}
      onClick={() => !disabled && !saving && onChange(!checked)}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 999,
        border: `1px solid ${checked ? COLORS.primary : COLORS.border}`,
        background: checked ? `${COLORS.primary}33` : "#040914",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background 0.2s ease, border-color 0.2s ease",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: checked ? COLORS.primary : "#64748B",
          boxShadow: checked ? `0 0 10px ${COLORS.primary}88` : "none",
          transition: "left 0.2s ease, background 0.2s ease",
        }}
      />
    </button>
  );
}

export default function RolePermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [grants, setGrants] = useState({});
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [toast, setToast] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await roleService.getPermissionMatrix();
      if (!res.success) {
        setError(res.message || "Failed to load permission matrix.");
        return;
      }
      setRoles(res.data.roles || []);
      setPermissions(res.data.permissions || []);
      setGrants(res.data.grants || {});
      if (!selectedRoleId && res.data.roles?.length) {
        const firstEditable = res.data.roles.find((r) => !r.isLocked) || res.data.roles[0];
        setSelectedRoleId(String(firstEditable.id));
      }
    } catch {
      setError("Could not reach backend services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedRole = roles.find((r) => String(r.id) === String(selectedRoleId));
  const roleGrants = useMemo(
    () => new Set(grants[String(selectedRoleId)] || []),
    [grants, selectedRoleId]
  );

  const groupedPermissions = useMemo(() => {
    const groups = {};
    for (const perm of permissions) {
      if (!groups[perm.category]) groups[perm.category] = [];
      groups[perm.category].push(perm);
    }
    return groups;
  }, [permissions]);

  async function togglePermission(permissionKey, nextEnabled) {
    if (!selectedRole || selectedRole.isLocked) return;

    const roleKey = String(selectedRole.id);
    const previous = grants[roleKey] || [];

    setSavingKey(permissionKey);
    setGrants((prev) => {
      const current = new Set(prev[roleKey] || []);
      if (nextEnabled) current.add(permissionKey);
      else current.delete(permissionKey);
      return { ...prev, [roleKey]: [...current] };
    });

    try {
      const res = await roleService.setPermission(selectedRole.id, permissionKey, nextEnabled);
      if (!res.success) {
        setGrants((prev) => ({ ...prev, [roleKey]: previous }));
        setToast({ type: "error", message: res.message || "Update failed." });
        return;
      }
      setToast({
        type: "success",
        message: nextEnabled ? `Permission "${permissionKey}" granted` : `Permission "${permissionKey}" revoked`,
      });
    } catch {
      setGrants((prev) => ({ ...prev, [roleKey]: previous }));
      setToast({ type: "error", message: "Could not reach backend services." });
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleCategory(category, enable) {
    if (!selectedRole || selectedRole.isLocked) return;

    const categoryPerms = groupedPermissions[category] || [];
    const roleKey = String(selectedRole.id);
    const currentSet = new Set(grants[roleKey] || []);

    categoryPerms.forEach((p) => {
      if (enable) currentSet.add(p.permission_key);
      else currentSet.delete(p.permission_key);
    });

    const updatedArray = [...currentSet];
    const previous = grants[roleKey] || [];

    setGrants((prev) => ({ ...prev, [roleKey]: updatedArray }));
    setSavingKey(`category-${category}`);

    try {
      const res = await roleService.batchSetPermissions(selectedRole.id, updatedArray);
      if (!res.success) {
        setGrants((prev) => ({ ...prev, [roleKey]: previous }));
        setToast({ type: "error", message: res.message || "Bulk update failed." });
        return;
      }
      setToast({
        type: "success",
        message: enable ? `All ${category} permissions enabled` : `All ${category} permissions disabled`,
      });
    } catch {
      setGrants((prev) => ({ ...prev, [roleKey]: previous }));
      setToast({ type: "error", message: "Failed to update category permissions." });
    } finally {
      setSavingKey(null);
    }
  }

  const enabledCount = roleGrants.size;
  const totalCount = permissions.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            padding: "12px 20px",
            borderRadius: 12,
            background: toast.type === "success" ? "#064E3B" : "#7F1D1D",
            border: `1px solid ${toast.type === "success" ? "#10B981" : "#EF4444"}`,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
            fontSize: 13.5,
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} color="#34D399" /> : <AlertTriangle size={18} color="#F87171" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
            Role Permissions & RBAC Matrix
          </h2>
          <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>
            Configure granular access controls and platform capabilities per role
          </div>
        </div>

        <Button variant="outline" size="sm" icon={RotateCw} onClick={load} disabled={loading}>
          Reload Matrix
        </Button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#EF444419", border: "1px solid #EF444455", color: "#EF4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Main Layout: Role Selector Sidebar + Permissions Matrix Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>
        {/* Role Selector List */}
        <Card hoverEffect={false} style={{ padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, paddingLeft: 4 }}>
            Roles & Accounts
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {roles.map((r) => {
              const isSelected = String(r.id) === String(selectedRoleId);
              const grantCount = (grants[String(r.id)] || []).length;

              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoleId(String(r.id))}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: isSelected ? `1px solid ${COLORS.primary}66` : "1px solid #1E293B33",
                    background: isSelected ? `${COLORS.primary}1A` : "#04091444",
                    color: isSelected ? "#fff" : "#94A3B8",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: isSelected ? COLORS.primary : "#F8FAFC" }}>
                      {r.name}
                    </span>
                    {r.isLocked ? (
                      <span title="Locked System Role" style={{ color: "#F59E0B" }}><Lock size={13} /></span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#64748B" }}>
                        {grantCount}/{totalCount}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748B" }}>
                    {r.description || "System access role"}
                  </div>
                  {r.user_count !== undefined && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569", marginTop: 4 }}>
                      <Users size={11} /> {r.user_count} assigned {r.user_count === 1 ? "user" : "users"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Selected Role Permissions Detail Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedRole && (
            <Card hoverEffect={false}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
                      {selectedRole.name} Permissions
                    </h3>
                    {selectedRole.isLocked && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: "#F59E0B1A",
                          color: "#F59E0B",
                          border: "1px solid #F59E0B44",
                        }}
                      >
                        <Lock size={11} /> Locked Role
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 4 }}>
                    {selectedRole.isLocked
                      ? "Super Admin holds immutable application-level access to prevent administrative lockouts."
                      : `Currently granted ${enabledCount} of ${totalCount} platform permissions.`}
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "#040914",
                    border: "1px solid #1E293B",
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: enabledCount > 0 ? COLORS.primary : "#64748B",
                  }}
                >
                  {Math.round((enabledCount / (totalCount || 1)) * 100)}% Coverage
                </div>
              </div>
            </Card>
          )}

          {/* Grouped Permission Cards */}
          {Object.entries(groupedPermissions).map(([category, perms]) => {
            const allEnabled = perms.every((p) => roleGrants.has(p.permission_key));
            const noneEnabled = perms.every((p) => !roleGrants.has(p.permission_key));

            return (
              <Card key={category} hoverEffect={false} style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[category] || "📦"}</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#F8FAFC" }}>
                      {category}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#64748B", padding: "1px 6px", borderRadius: 4, background: "#1E293B66" }}>
                      {perms.length}
                    </span>
                  </div>

                  {!selectedRole?.isLocked && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category, true)}
                        disabled={allEnabled || savingKey === `category-${category}`}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: allEnabled ? "#334155" : COLORS.primary,
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: allEnabled ? "default" : "pointer",
                        }}
                      >
                        Enable All
                      </button>
                      <span style={{ color: "#334155" }}>·</span>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category, false)}
                        disabled={noneEnabled || savingKey === `category-${category}`}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: noneEnabled ? "#334155" : "#EF4444",
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: noneEnabled ? "default" : "pointer",
                        }}
                      >
                        Disable All
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                  {perms.map((p) => {
                    const isGranted = selectedRole?.isLocked || roleGrants.has(p.permission_key);
                    const isSaving = savingKey === p.permission_key;

                    return (
                      <div
                        key={p.permission_key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 14px",
                          borderRadius: 10,
                          background: isGranted ? "#040914" : "#04091455",
                          border: isGranted ? `1px solid ${COLORS.primary}33` : "1px solid #1E293B44",
                        }}
                      >
                        <div style={{ paddingRight: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isGranted ? "#F8FAFC" : "#64748B" }}>
                            {p.label}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
                            {p.description}
                          </div>
                          <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: "#475569", marginTop: 3 }}>
                            {p.permission_key}
                          </div>
                        </div>

                        <ToggleSwitch
                          checked={isGranted}
                          disabled={selectedRole?.isLocked}
                          saving={isSaving}
                          onChange={(next) => togglePermission(p.permission_key, next)}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
