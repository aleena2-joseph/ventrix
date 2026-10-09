const pool = require("../config/db");

// Streamlined asset select: Train -> Coach -> HVAC Asset
const ASSET_SELECT = `
  SELECT a.*,
         c.coach_number, c.coach_type,
         t.id AS train_id, t.train_number
  FROM assets a
  LEFT JOIN coaches c ON a.coach_id = c.id
  LEFT JOIN trains t ON c.train_id = t.id
`;

const findAssetByCode = async (assetCode) => {
  const result = await pool.query(`${ASSET_SELECT} WHERE a.asset_code = $1`, [assetCode]);
  return result.rows[0];
};

const getAllAssets = async () => {
  const result = await pool.query(`${ASSET_SELECT} ORDER BY a.id ASC`);
  return result.rows;
};

const WRITABLE_FIELDS = [
  "asset_code",
  "name",
  "asset_type",
  "coach_id",
  "zone",
  "install_date",
  "serial_number",
  "warranty_start",
  "warranty_end",
  "metadata", // "Configuration" in the UI
];

const sanitizeAssetFields = (fields) => {
  const sanitized = { ...fields };

  // Integer columns: convert empty string / NaN to null
  ["coach_id"].forEach((col) => {
    if (sanitized[col] === "" || sanitized[col] === undefined || sanitized[col] === null) {
      sanitized[col] = null;
    } else {
      const parsed = parseInt(sanitized[col], 10);
      sanitized[col] = isNaN(parsed) ? null : parsed;
    }
  });

  // Date columns: convert empty string to null
  ["install_date", "warranty_start", "warranty_end"].forEach((col) => {
    if (sanitized[col] === "" || sanitized[col] === undefined) {
      sanitized[col] = null;
    }
  });

  // String columns: convert empty string to null
  ["zone", "serial_number"].forEach((col) => {
    if (sanitized[col] === "") {
      sanitized[col] = null;
    }
  });

  return sanitized;
};

const createAsset = async (rawFields) => {
  const fields = sanitizeAssetFields(rawFields);
  const columns = WRITABLE_FIELDS.filter((col) => fields[col] !== undefined);
  const values = columns.map((col) => fields[col]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

  const result = await pool.query(
    `INSERT INTO assets (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return findAssetByCode(result.rows[0].asset_code);
};

const updateAsset = async (assetCode, rawFields) => {
  const fields = sanitizeAssetFields(rawFields);
  const columns = WRITABLE_FIELDS.filter((col) => fields[col] !== undefined && col !== "asset_code");
  if (columns.length === 0) return findAssetByCode(assetCode);

  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");
  const values = columns.map((col) => fields[col]);

  await pool.query(
    `UPDATE assets SET ${setClause}, updated_at = NOW() WHERE asset_code = $${columns.length + 1}`,
    [...values, assetCode]
  );
  return findAssetByCode(assetCode);
};

const VALID_STATUSES = ["OPERATIONAL", "WARNING", "MAINTENANCE", "OFFLINE", "DECOMMISSIONED"];

const updateAssetStatus = async (assetCode, status) => {
  await pool.query(
    `UPDATE assets SET status = $1, updated_at = NOW() WHERE asset_code = $2`,
    [status, assetCode]
  );
  return findAssetByCode(assetCode);
};

// Used by hierarchyController-style ownership checks and by the asset
// controller to reject a customer trying to read/write another org's asset.
const assetBelongsToOrganization = async (assetCode, organizationId) => {
  const result = await pool.query(`${ASSET_SELECT} WHERE a.asset_code = $1 AND o.id = $2`, [
    assetCode, organizationId,
  ]);
  return result.rows.length > 0;
};

module.exports = {
  findAssetByCode,
  getAllAssets,
  createAsset,
  updateAsset,
  updateAssetStatus,
  assetBelongsToOrganization,
  VALID_STATUSES,
};
