import React, { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, X, Search } from "lucide-react";
import Card from "./Card";
import Button from "./Button";

/**
 * A reusable list + add/edit-modal page for simple CRUD modules.
 *
 * columns: [{ key, label, render?(row) }]  — what the table shows
 * fields:  [{ key, label, type?, options?, required? }] — the form
 * service: { list, create, update } async functions returning the
 *          standard { success, data, message } envelope
 * searchKeys: which row fields the search box filters on
 */
export default function CrudTable({
  title,
  columns,
  fields,
  service,
  searchKeys = [],
  emptyMessage = "No records yet.",
  canWrite = true,
  extraActions,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await service.list();
      if (!res.success) {
        setError(res.message || "Failed to load data");
      } else {
        setRows(res.data || []);
        setError(null);
      }
    } catch (err) {
      setError("Could not reach the backend. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim() || searchKeys.length === 0) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
  }, [rows, search, searchKeys]);

  function openCreate() {
    setEditingRow(null);
    const blank = {};
    fields.forEach((f) => (blank[f.key] = f.default ?? ""));
    setForm(blank);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(row) {
    setEditingRow(row);
    const initial = {};
    fields.forEach((f) => (initial[f.key] = row[f.key] ?? ""));
    setForm(initial);
    setFormError(null);
    setShowForm(true);
  }

  async function submit(e) {
    e.preventDefault();
    const missing = fields.find((f) => f.required && !String(form[f.key] ?? "").trim());
    if (missing) {
      setFormError(`${missing.label} is required.`);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = editingRow
        ? await service.update(editingRow.id, form)
        : await service.create(form);
      if (!res.success) {
        setFormError(res.message || "Save failed.");
        return;
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError("Could not reach the backend.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#EF444419", border: "1px solid #EF444455", color: "#EF4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 600, color: "#fff", margin: 0 }}>
          {title}
        </h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {searchKeys.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0B1220", border: "1px solid #1E293B", borderRadius: 10, padding: "8px 12px" }}>
              <Search size={14} color="#64748B" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                style={{ background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 13 }}
              />
            </div>
          )}
          {canWrite && (
            <Button variant="glow" size="sm" icon={Plus} onClick={openCreate}>
              Add
            </Button>
          )}
        </div>
      </div>

      <Card hoverEffect={false}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748B", fontSize: 12 }}>
                {columns.map((c) => (
                  <th key={c.key} style={{ padding: "8px 6px", fontWeight: 500 }}>{c.label}</th>
                ))}
                {canWrite && <th style={{ padding: "8px 6px" }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid #1E293B" }}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ padding: "12px 6px", color: "#E2E8F0" }}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                  {canWrite && (
                    <td style={{ padding: "12px 6px", textAlign: "right" }}>
                      <button
                        onClick={() => openEdit(row)}
                        style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: "24px 6px", textAlign: "center", color: "#64748B" }}>
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {extraActions}
      </Card>

      {showForm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(3,7,18,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
          onClick={() => setShowForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#0B1220", border: "1px solid #1E293B", borderRadius: 16, padding: 28, width: 520, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 17, color: "#fff" }}>
                {editingRow ? `Edit ${title.replace(/s$/, "")}` : `Add ${title.replace(/s$/, "")}`}
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#EF444419", border: "1px solid #EF444455", color: "#EF4444", fontSize: 12.5, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {fields.map((f) => (
                <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#94A3B8" }}>
                  {f.label}{f.required ? " *" : ""}
                  {f.type === "select" ? (
                    <select
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "9px 10px", fontSize: 13.5 }}
                    >
                      <option value="">Select...</option>
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      rows={3}
                      style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "9px 10px", fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }}
                    />
                  ) : (
                    <input
                      type={f.type || "text"}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      disabled={f.disabledOnEdit && !!editingRow}
                      style={{ background: "#040914", color: "#fff", border: "1px solid #1E293B", borderRadius: 8, padding: "9px 10px", fontSize: 13.5, opacity: f.disabledOnEdit && editingRow ? 0.6 : 1 }}
                    />
                  )}
                </label>
              ))}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="glow" size="sm" disabled={saving}>
                  {saving ? "Saving..." : editingRow ? "Save Changes" : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
