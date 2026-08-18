const pool = require("../config/db");
const buildCrud = require("../utils/crudFactory");

const categories = buildCrud("part_categories", ["name"], "id", "name ASC");
const parts = buildCrud(
  "parts",
  ["part_code", "name", "category_id", "unit", "minimum_stock", "unit_price", "status"],
  "id",
  "name ASC"
);

// GET /api/inventory/parts — parts joined with category name and total
// quantity on hand across all warehouse locations, plus a low_stock flag
// so the frontend doesn't need to compute it.
const getPartsWithStock = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, pc.name AS category_name,
             COALESCE(SUM(i.quantity), 0)::int AS total_quantity,
             (COALESCE(SUM(i.quantity), 0) < p.minimum_stock) AS low_stock
      FROM parts p
      LEFT JOIN part_categories pc ON p.category_id = pc.id
      LEFT JOIN inventory i ON i.part_id = p.id
      GROUP BY p.id, pc.name
      ORDER BY p.name ASC
    `);
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("❌ Failed to fetch parts with stock:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch parts" });
  }
};

// GET /api/inventory/stock/:partId — per-location breakdown for one part.
const getStockForPart = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inventory WHERE part_id = $1 ORDER BY location ASC",
      [req.params.partId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch stock" });
  }
};

// POST /api/inventory/stock/adjust
// Body: { partId, location, quantityChange, transactionType, referenceType, referenceId }
// quantityChange is signed (+10 received, -1 used). Upserts the
// inventory row and always writes a stock_transactions row so there's
// a real audit trail behind every quantity change.
const adjustStock = async (req, res) => {
  const client = await pool.connect();
  try {
    const { partId, location, quantityChange, transactionType, referenceType, referenceId } = req.body;

    if (!partId || !location || !quantityChange || !transactionType) {
      return res.status(400).json({
        success: false,
        message: "partId, location, quantityChange, and transactionType are required",
      });
    }

    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT * FROM inventory WHERE part_id = $1 AND location = $2 FOR UPDATE",
      [partId, location]
    );

    let inventoryRow;
    if (existing.rows.length === 0) {
      const inserted = await client.query(
        `INSERT INTO inventory (part_id, location, quantity) VALUES ($1, $2, $3) RETURNING *`,
        [partId, location, Math.max(0, quantityChange)]
      );
      inventoryRow = inserted.rows[0];
    } else {
      const newQty = existing.rows[0].quantity + Number(quantityChange);
      if (newQty < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Adjustment would make stock negative" });
      }
      const updated = await client.query(
        `UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newQty, existing.rows[0].id]
      );
      inventoryRow = updated.rows[0];
    }

    await client.query(
      `INSERT INTO stock_transactions (part_id, inventory_id, transaction_type, quantity, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [partId, inventoryRow.id, transactionType, quantityChange, referenceType || "manual", referenceId || null]
    );

    await client.query("COMMIT");
    res.status(200).json({ success: true, message: "Stock updated", data: inventoryRow });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to adjust stock:", error.message);
    res.status(500).json({ success: false, message: "Failed to adjust stock" });
  } finally {
    client.release();
  }
};

// GET /api/inventory/transactions/:partId — history for one part.
const getTransactionsForPart = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM stock_transactions WHERE part_id = $1 ORDER BY created_at DESC LIMIT 50",
      [req.params.partId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch stock history" });
  }
};

module.exports = {
  categories,
  parts,
  getPartsWithStock,
  getStockForPart,
  adjustStock,
  getTransactionsForPart,
};
