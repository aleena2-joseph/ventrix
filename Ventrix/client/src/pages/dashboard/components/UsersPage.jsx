import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  X,
  Power,
  Edit2,
  KeyRound,
  Trash2,
  Users as UsersIcon,
  ShieldCheck,
  Building2,
  UserCheck,
  UserX,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
} from "lucide-react";
import Card from "../../../components/common/Card";
import Button from "../../../components/common/Button";
import { userService } from "../../../services/userService";
import { roleService } from "../../../services/roleService";
import { useAuth } from "../../../context/AuthContext";

const ROLE_COLORS = {
  ADMIN: { c: "#06B6D4", bg: "rgba(6, 182, 212, 0.15)", label: "Admin" },
  VENTRIX_ADMIN: { c: "#06B6D4", bg: "rgba(6, 182, 212, 0.15)", label: "Admin" },
  ENGINEER: { c: "#3B82F6", bg: "rgba(59, 130, 246, 0.15)", label: "Engineer" },
  TECHNICIAN: { c: "#10B981", bg: "rgba(16, 185, 129, 0.15)", label: "Technician" },
};

const ROLE_BADGES = ROLE_COLORS;

export default function UsersPage() {
  const { user: currentUser, can } = useAuth();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    roleId: "",
    status: "ACTIVE",
  });

  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const canManage = can("users.manage");

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        userService.list({
          search: search || undefined,
          roleId: roleFilter !== "ALL" ? roleFilter : undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
        }),
        roleService.list(),
      ]);

      if (usersRes.success) setUsers(usersRes.data || []);
      else setError(usersRes.message || "Failed to load users.");

      if (rolesRes?.success) {
        setRoles(rolesRes.data || []);
      }
    } catch {
      setError("Could not reach backend services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  // KPI calculations
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const inactive = total - active;
    const adminCount = users.filter((u) => u.role_name?.includes("ADMIN")).length;
    return { total, active, inactive, adminCount };
  }, [users]);

  // Create User Submit
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!createForm.name || !createForm.email || !createForm.password || !createForm.roleId) {
      setFormError("Please fill all required fields.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        roleId: Number(createForm.roleId),
      };

      const res = await userService.create(payload);
      if (!res.success) {
        setFormError(res.message || "Failed to create user.");
        return;
      }

      notify("success", `User "${payload.name}" created successfully.`);
      setShowAddModal(false);
      setCreateForm({ name: "", email: "", password: "", roleId: "" });
      loadData();
    } catch {
      setFormError("An unexpected error occurred while creating user.");
    } finally {
      setSaving(false);
    }
  };

  // Edit User Submit
  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(null);

    if (!editForm.name || !editForm.email || !editForm.roleId) {
      setFormError("Name, email, and role are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        roleId: Number(editForm.roleId),
        status: editForm.status,
      };

      const res = await userService.update(editingUser.id, payload);
      if (!res.success) {
        setFormError(res.message || "Failed to update user.");
        return;
      }

      notify("success", `User "${payload.name}" updated successfully.`);
      setEditingUser(null);
      loadData();
    } catch {
      setFormError("An unexpected error occurred while updating user.");
    } finally {
      setSaving(false);
    }
  };

  // Reset Password Submit
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resettingUser) return;
    setFormError(null);

    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    setSaving(true);
    try {
      const res = await userService.resetPassword(resettingUser.id, resetPasswordVal);
      if (!res.success) {
        setFormError(res.message || "Failed to reset password.");
        return;
      }

      notify("success", `Password reset for "${resettingUser.name}".`);
      setResettingUser(null);
      setResetPasswordVal("");
    } catch {
      setFormError("An error occurred while resetting password.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await userService.updateStatus(user.id, nextStatus);
      if (!res.success) {
        notify("error", res.message || "Failed to change user status.");
        return;
      }
      notify("success", `User status changed to ${nextStatus}.`);
      loadData();
    } catch {
      notify("error", "Error changing user status.");
    }
  };

  // Delete User Submit
  const handleDelete = async () => {
    if (!deletingUser) return;
    setSaving(true);
    try {
      const res = await userService.remove(deletingUser.id);
      if (!res.success) {
        notify("error", res.message || "Failed to delete user.");
        return;
      }
      notify("success", `User "${deletingUser.name}" deleted.`);
      setDeletingUser(null);
      loadData();
    } catch {
      notify("error", "Failed to delete user.");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (u) => {
    setFormError(null);
    setEditingUser(u);
    setEditForm({
      name: u.name || "",
      email: u.email || "",
      roleId: u.role_id ? String(u.role_id) : "",
      status: u.status || "ACTIVE",
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: toast.type === "success" ? "#064E3B" : "#7F1D1D",
            border: `1px solid ${toast.type === "success" ? "#10B981" : "#EF4444"}`,
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>
            User Management
          </h1>
          <p style={{ color: "#94A3B8", fontSize: 13.5, margin: "4px 0 0 0" }}>
            Manage platform accounts, assigned system roles, and account security.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RotateCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </Button>

          {canManage && (
            <Button
              variant="glow"
              size="sm"
              onClick={() => {
                setFormError(null);
                setCreateForm({ name: "", email: "", password: "", roleId: roles[0]?.id ? String(roles[0].id) : "" });
                setShowAddModal(true);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={16} />
              Add User
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "#EF44441A",
            border: "1px solid #EF444444",
            color: "#EF4444",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13.5,
          }}
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Total Users</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginTop: 4, fontFamily: "'Outfit', sans-serif" }}>
                {stats.total}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#06B6D41A", border: "1px solid #06B6D433", display: "flex", alignItems: "center", justifyContent: "center", color: "#06B6D4" }}>
              <UsersIcon size={20} />
            </div>
          </div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Active Accounts</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#22C55E", marginTop: 4, fontFamily: "'Outfit', sans-serif" }}>
                {stats.active}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#22C55E1A", border: "1px solid #22C55E33", display: "flex", alignItems: "center", justifyContent: "center", color: "#22C55E" }}>
              <UserCheck size={20} />
            </div>
          </div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Inactive Accounts</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#94A3B8", marginTop: 4, fontFamily: "'Outfit', sans-serif" }}>
                {stats.inactive}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#94A3B81A", border: "1px solid #94A3B833", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
              <UserX size={20} />
            </div>
          </div>
        </Card>

        <Card hoverEffect={false}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Administrators</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#EC4899", marginTop: 4, fontFamily: "'Outfit', sans-serif" }}>
                {stats.adminCount}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EC48991A", border: "1px solid #EC489933", display: "flex", alignItems: "center", justifyContent: "center", color: "#EC4899" }}>
              <ShieldCheck size={20} />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card hoverEffect={false}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, flex: "1 1 260px", maxWidth: 420 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search
                size={16}
                color="#64748B"
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                placeholder="Search user by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  background: "#040914",
                  color: "#fff",
                  border: "1px solid #1E293B",
                  borderRadius: 8,
                  padding: "8px 12px 8px 36px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
            <Button type="submit" variant="outline" size="sm">Search</Button>
          </form>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                background: "#040914",
                color: "#E2E8F0",
                border: "1px solid #1E293B",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
              }}
            >
              <option value="ALL">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: "#040914",
                color: "#E2E8F0",
                border: "1px solid #1E293B",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card hoverEffect={false}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748B", fontSize: 12, borderBottom: "1px solid #1E293B" }}>
                <th style={{ padding: "12px 10px" }}>User</th>
                <th style={{ padding: "12px 10px" }}>Role</th>
                <th style={{ padding: "12px 10px" }}>Status</th>
                <th style={{ padding: "12px 10px" }}>Created</th>
                {canManage && <th style={{ padding: "12px 10px", textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roleMeta = ROLE_COLORS[u.role_name] || { c: "#94A3B8", bg: "#94A3B81A", label: u.role_name };
                const initial = u.name?.trim().charAt(0).toUpperCase() || "?";
                const isSelf = u.id === currentUser?.id;

                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #1E293B33" }}>
                    <td style={{ padding: "14px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            background: roleMeta.bg,
                            border: `1px solid ${roleMeta.c}44`,
                            color: roleMeta.c,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 13,
                            fontFamily: "'Outfit', sans-serif",
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#F8FAFC", display: "flex", alignItems: "center", gap: 6 }}>
                            {u.name}
                            {isSelf && (
                              <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "#06B6D422", color: "#06B6D4" }}>
                                You
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: roleMeta.c,
                          background: roleMeta.bg,
                          border: `1px solid ${roleMeta.c}33`,
                          display: "inline-block",
                        }}
                      >
                        {roleMeta.label || u.role_name}
                      </span>
                    </td>

                    <td style={{ padding: "14px 10px" }}>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: 20,
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: u.status === "ACTIVE" ? "#22C55E" : "#EF4444",
                          background: u.status === "ACTIVE" ? "#22C55E1A" : "#EF444419",
                          border: `1px solid ${u.status === "ACTIVE" ? "#22C55E33" : "#EF444433"}`,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.status === "ACTIVE" ? "#22C55E" : "#EF4444" }} />
                        {u.status}
                      </span>
                    </td>

                    <td style={{ padding: "14px 10px", color: "#64748B", fontSize: 12.5 }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>

                    {canManage && (
                      <td style={{ padding: "14px 10px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {/* Edit Button */}
                          <button
                            title="Edit User Profile"
                            onClick={() => openEditModal(u)}
                            style={{
                              background: "transparent",
                              border: "1px solid #1E293B",
                              borderRadius: 6,
                              padding: "6px 8px",
                              color: "#94A3B8",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <Edit2 size={14} />
                          </button>

                          {/* Reset Password Button */}
                          <button
                            title="Reset Password"
                            onClick={() => {
                              setFormError(null);
                              setResettingUser(u);
                              setResetPasswordVal("");
                            }}
                            style={{
                              background: "transparent",
                              border: "1px solid #1E293B",
                              borderRadius: 6,
                              padding: "6px 8px",
                              color: "#94A3B8",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <KeyRound size={14} />
                          </button>

                          {/* Toggle Status Button */}
                          <button
                            title={u.status === "ACTIVE" ? "Deactivate User" : "Activate User"}
                            disabled={isSelf}
                            onClick={() => handleToggleStatus(u)}
                            style={{
                              background: "transparent",
                              border: "1px solid #1E293B",
                              borderRadius: 6,
                              padding: "6px 8px",
                              color: isSelf ? "#334155" : u.status === "ACTIVE" ? "#F59E0B" : "#22C55E",
                              cursor: isSelf ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <Power size={14} />
                          </button>

                          {/* Delete Button */}
                          <button
                            title="Delete User"
                            disabled={isSelf}
                            onClick={() => setDeletingUser(u)}
                            style={{
                              background: "transparent",
                              border: "1px solid #1E293B",
                              borderRadius: 6,
                              padding: "6px 8px",
                              color: isSelf ? "#334155" : "#EF4444",
                              cursor: isSelf ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "36px 12px", textAlign: "center", color: "#64748B" }}>
                    <UsersIcon size={28} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
                    <div>No users match the selected criteria.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= MODALS ================= */}

      {/* 1. Add User Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3,7,18,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1px solid #1E293B",
              borderRadius: 16,
              padding: 28,
              width: 480,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>
                Add New User
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#EF444419", border: "1px solid #EF444455", color: "#EF4444", fontSize: 12.5, marginBottom: 16 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Full Name *
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Email Address *
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul.sharma@example.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Initial Password *
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Assigned Role *
                <select
                  required
                  value={createForm.roleId}
                  onChange={(e) => setCreateForm((p) => ({ ...p, roleId: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                >
                  <option value="">Select Role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} — {r.description || ""}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" variant="glow" size="sm" disabled={saving}>
                  {saving ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit User Modal */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3,7,18,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setEditingUser(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1px solid #1E293B",
              borderRadius: 16,
              padding: 28,
              width: 480,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff" }}>
                Edit User: {editingUser.name}
              </div>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#EF444419", border: "1px solid #EF444455", color: "#EF4444", fontSize: 12.5, marginBottom: 16 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleEdit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Full Name *
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Email Address *
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Role *
                <select
                  required
                  value={editForm.roleId}
                  onChange={(e) => setEditForm((p) => ({ ...p, roleId: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                Status
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit" variant="glow" size="sm" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Reset Password Modal */}
      {resettingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3,7,18,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setResettingUser(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1px solid #1E293B",
              borderRadius: 16,
              padding: 28,
              width: 420,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 17, color: "#fff" }}>
                Reset Password
              </div>
              <button
                onClick={() => setResettingUser(null)}
                style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#94A3B8", marginTop: 0, marginBottom: 16 }}>
              Enter a new temporary password for <strong>{resettingUser.name}</strong> ({resettingUser.email}).
            </p>

            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#EF444419", border: "1px solid #EF444455", color: "#EF4444", fontSize: 12.5, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="password"
                required
                placeholder="New Password (min 6 characters)"
                value={resetPasswordVal}
                onChange={(e) => setResetPasswordVal(e.target.value)}
                style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setResettingUser(null)}>Cancel</Button>
                <Button type="submit" variant="glow" size="sm" disabled={saving}>
                  {saving ? "Resetting..." : "Set Password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {deletingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(3,7,18,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
          onClick={() => setDeletingUser(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0B1220",
              border: "1px solid #EF444444",
              borderRadius: 16,
              padding: 28,
              width: 440,
              maxWidth: "100%",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#EF4444", marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EF444419", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={20} />
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 18 }}>
                Delete User Account?
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: "#94A3B8", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              Are you sure you want to permanently delete <strong>{deletingUser.name}</strong> ({deletingUser.email})? This action cannot be undone.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button type="button" variant="outline" size="sm" onClick={() => setDeletingUser(null)}>Cancel</Button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                style={{
                  background: "#DC2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {saving ? "Deleting..." : "Yes, Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
