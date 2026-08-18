const pool = require("../config/db");

// Every asset row returned to the frontend is joined all the way up to
// product + coach + train + project + organization, since that join is
// what makes "which customer owns this" derivable without a customer_id
// column on assets itself.
const ASSET_SELECT = `
  SELECT a.*,
         pr.product_code, pr.name AS product_name, pr.specifications AS product_specifications,
         c.coach_number, c.coach_type,
         t.id AS train_id, t.train_number,
         pj.id AS project_id, pj.name AS project_name,
         o.id AS organization_id, o.name AS organization_name
  FROM assets a
  LEFT JOIN products pr ON a.product_id = pr.id
  LEFT JOIN coaches c ON a.coach_id = c.id
  LEFT JOIN trains t ON c.train_id = t.id
  LEFT JOIN projects pj ON t.project_id = pj.id
  LEFT JOIN organizations o ON pj.organization_id = o.id
`;

const findAssetByCode = async (assetCode) => {
  const result = await pool.query(`${ASSET_SELECT} WHERE a.asset_code = $1`, [assetCode]);
  return result.rows[0];
};

// organizationId = null -> all assets (Ventrix staff). Non-null ->
// scoped to that org only (customer roles).
const getAllAssets = async (organizationId = null) => {
  const result = await pool.query(
    `${ASSET_SELECT} WHERE ($1::int IS NULL OR o.id = $1) ORDER BY a.id ASC`,
    [organizationId]
  );
  return result.rows;
};

const WRITABLE_FIELDS = [
  "asset_code",
  "name",
  "asset_type",
  "product_id",
  "coach_id",
  "zone",
  "status",
  "install_date",
  "serial_number",
  "warranty_start",
  "warranty_end",
  "metadata", // "Configuration" in the UI
];

const createAsset = async (fields) => {
  const columns = WRITABLE_FIELDS.filter((col) => fields[col] !== undefined);
  const values = columns.map((col) => fields[col]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

  const result = await pool.query(
    `INSERT INTO assets (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return findAssetByCode(result.rows[0].asset_code);
};

const updateAsset = async (assetCode, fields) => {
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
