const pool = require("../config/db");

/**
 * Builds { getAll, getById, create, update } handlers for a simple table
 * that doesn't need custom joins or organization scoping. Cuts down on
 * repeating the same INSERT/UPDATE-column-list boilerplate across the
 * many small reference tables in this schema (organizations, products,
 * part_categories, parts, suppliers, payments, asset_documents...).
 *
 * @param {string} table - table name
 * @param {string[]} writableFields - columns a create/update may set
 * @param {string} [idColumn='id']
 * @param {string} [orderBy] - defaults to `${idColumn} ASC`
 */
function buildCrud(table, writableFields, idColumn = "id", orderBy = null) {
  const order = orderBy || `${idColumn} ASC`;

  const getAll = async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`);
      res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
      console.error(`❌ Failed to list ${table}:`, error.message);
      res.status(500).json({ success: false, message: `Failed to list ${table}` });
    }
  };

  const getById = async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM ${table} WHERE ${idColumn} = $1`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: `${table} record not found` });
      }
      res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error(`❌ Failed to fetch ${table}:`, error.message);
      res.status(500).json({ success: false, message: `Failed to fetch ${table}` });
    }
  };

  const create = async (req, res) => {
    try {
      const columns = writableFields.filter((f) => req.body[f] !== undefined);
      if (columns.length === 0) {
        return res.status(400).json({ success: false, message: "No valid fields provided" });
      }
      const values = columns.map((c) => req.body[c]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      res.status(201).json({ success: true, message: "Created", data: result.rows[0] });
    } catch (error) {
      console.error(`❌ Failed to create ${table} row:`, error.message);
      res.status(500).json({ success: false, message: error.message || `Failed to create ${table}` });
    }
  };

  const update = async (req, res) => {
    try {
      const columns = writableFields.filter((f) => req.body[f] !== undefined);
      if (columns.length === 0) {
        return res.status(400).json({ success: false, message: "No valid fields provided" });
      }
      const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(", ");
      const values = columns.map((c) => req.body[c]);
      const result = await pool.query(
        `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = $${columns.length + 1} RETURNING *`,
        [...values, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: `${table} record not found` });
      }
      res.status(200).json({ success: true, message: "Updated", data: result.rows[0] });
    } catch (error) {
      console.error(`❌ Failed to update ${table} row:`, error.message);
      res.status(500).json({ success: false, message: error.message || `Failed to update ${table}` });
    }
  };

  const remove = async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM ${table} WHERE ${idColumn} = $1 RETURNING *`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: `${table} record not found` });
      }
      res.status(200).json({ success: true, message: "Deleted" });
    } catch (error) {
      // Foreign-key protected tables (e.g. a part still referenced by
      // inventory) will land here — surface it plainly instead of a 500.
      console.error(`❌ Failed to delete ${table} row:`, error.message);
      res.status(409).json({
        success: false,
        message: `Cannot delete — this record is still referenced elsewhere (${error.message})`,
      });
    }
  };

  return { getAll, getById, create, update, remove };
}

module.exports = buildCrud;
