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
import { useTheme } from "../../../context/ThemeContext";

const CATEGORY_ICONS = {
  Monitoring: "📡",
  Assets: "🚆",
  Operations: "⚙️",
  Administration: "🔐",
};

function ToggleSwitch({ checked, disabled, onChange, saving, isDark, primaryColor }) {
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
        border: `1px solid ${checked ? primaryColor : isDark ? "rgba(255,255,255,0.15)" : "#CBD5E1"}`,
        background: checked
          ? (isDark ? "rgba(6,182,212,0.3)" : "rgba(2,132,199,0.2)")
          : (isDark ? "#0B1120" : "#E2E8F0"),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
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
          background: checked ? primaryColor : (isDark ? "#94A3B8" : "#64748B"),
          boxShadow: checked ? `0 0 10px ${primaryColor}88` : "none",
          transition: "left 0.2s ease, background 0.2s ease",
        }}
      />
    </button>
  );
}

export default function RolePermissionsPage() {
  const { isDark, tokens: t } = useTheme();

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

  async function toggleCategory(category, enableAll) {
    if (!selectedRole || selectedRole.isLocked) return;

    const categoryPerms = groupedPermissions[category] || [];
    const keys = categoryPerms.map((p) => p.permission_key);
    const roleKey = String(selectedRole.id);
    const previous = grants[roleKey] || [];

    const updated = new Set(previous);
    for (const k of keys) {
      if (enableAll) updated.add(k);
      else updated.delete(k);
    }

    const updatedArray = [...updated];
    setSavingKey(`category-${category}`);
    setGrants((prev) => ({ ...prev, [roleKey]: updatedArray }));

    try {
      const res = await roleService.batchSetPermissions(selectedRole.id, updatedArray);
      if (!res.success) {
        setGrants((prev) => ({ ...prev, [roleKey]: previous }));
        setToast({ type: "error", message: res.message || "Batch update failed." });
        return;
      }
      setToast({
        type: "success",
        message: `${category}: all permissions ${enableAll ? "granted" : "revoked"}`,
      });
    } catch {
      setGrants((prev) => ({ ...prev, [roleKey]: previous }));
      setToast({ type: "error", message: "Could not reach backend services." });
    } finally {
      setSavingKey(null);
    }
  }

  const enabledCount = selectedRole?.isLocked ? permissions.length : roleGrants.size;
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
            zIndex: 9999,
            padding: "12px 18px",
            borderRadius: 10,
            background: toast.type === "success" ? (isDark ? "rgba(6, 78, 59, 0.9)" : "#ECFDF5") : (isDark ? "rgba(127, 29, 29, 0.9)" : "#FEF2F2"),
            border: `1px solid ${toast.type === "success" ? "#10B981" : "#EF4444"}`,
            color: toast.type === "success" ? (isDark ? "#6EE7B7" : "#065F46") : (isDark ? "#FCA5A5" : "#991B1B"),
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: t.shadow,
            fontSize: 13.5,
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} color="#10B981" /> : <AlertTriangle size={18} color="#EF4444" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: 24, fontWeight: 800, color: t.textHeading, margin: 0 }}>
            Role Permissions & RBAC Matrix
          </h2>
          <div style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>
            Configure granular access controls and platform capabilities per role
          </div>
        </div>

        <Button variant="outline" size="sm" icon={RotateCw} onClick={load} disabled={loading}>
          Reload Matrix
        </Button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", color: "#EF4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Main Layout: Role Selector Sidebar + Permissions Matrix Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>
        {/* Role Selector List */}
        <Card hoverEffect={false} style={{ padding: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, paddingLeft: 4 }}>
            Roles & Accounts
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                    borderRadius: 12,
                    border: isSelected
                      ? `1px solid ${t.primary}`
                      : `1px solid ${t.border}`,
                    background: isSelected
                      ? t.primaryBg
                      : t.cardInner,
                    color: isSelected ? t.primary : t.textMuted,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: isSelected ? t.primary : t.textHeading }}>
                      {r.name}
                    </span>
                    {r.isLocked ? (
                      <span title="Locked System Role" style={{ color: "#F59E0B" }}><Lock size={13} /></span>
                    ) : (
                      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>
                        {grantCount}/{totalCount}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: t.textMuted }}>
                    {r.description || "System access role"}
                  </div>
                  {r.user_count !== undefined && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.textMuted, marginTop: 4 }}>
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
                    <h3 style={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: t.textHeading, margin: 0 }}>
                      {selectedRole.name} Permissions
                    </h3>
                    {selectedRole.isLocked && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: "rgba(245, 158, 11, 0.15)",
                          color: isDark ? "#FBBF24" : "#D97706",
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                        }}
                      >
                        <Lock size={11} /> System Protected
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 4 }}>
                    {selectedRole.isLocked
                      ? "Admin holds immutable application-level access to prevent system lockouts."
                      : `Currently granted ${enabledCount} of ${totalCount} platform permissions.`}
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: t.cardInner,
                    border: `1px solid ${t.border}`,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    color: enabledCount > 0 ? t.primary : t.textMuted,
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
                    <span style={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: 15, fontWeight: 700, color: t.textHeading }}>
                      {category}
                    </span>
                    <span style={{ fontSize: 11.5, color: t.textMuted, padding: "2px 8px", borderRadius: 6, background: t.cardInner, border: `1px solid ${t.border}` }}>
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
                          color: allEnabled ? t.textMuted : t.primary,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: allEnabled ? "default" : "pointer",
                        }}
                      >
                        Enable All
                      </button>
                      <span style={{ color: t.textMuted }}>·</span>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category, false)}
                        disabled={noneEnabled || savingKey === `category-${category}`}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: noneEnabled ? t.textMuted : "#EF4444",
                          fontSize: 12,
                          fontWeight: 600,
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
                          borderRadius: 12,
                          background: isGranted
                            ? (isDark ? "rgba(6, 182, 212, 0.07)" : "rgba(2, 132, 199, 0.05)")
                            : t.cardInner,
                          border: isGranted
                            ? `1px solid ${isDark ? "rgba(6, 182, 212, 0.3)" : "rgba(2, 132, 199, 0.25)"}`
                            : `1px solid ${t.border}`,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ paddingRight: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isGranted ? t.textHeading : t.textMuted }}>
                            {p.label}
                          </div>
                          <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>
                            {p.description}
                          </div>
                          <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: isDark ? "#64748B" : "#94A3B8", marginTop: 3 }}>
                            {p.permission_key}
                          </div>
                        </div>

                        <ToggleSwitch
                          checked={isGranted}
                          disabled={selectedRole?.isLocked}
                          saving={isSaving}
                          isDark={isDark}
                          primaryColor={t.primary}
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
