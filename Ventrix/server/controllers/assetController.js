const assetModel = require("../models/assetModel");
const { isCustomerRole } = require("../middleware/roles");
const auditModel = require("../models/auditModel");

// GET /api/assets — Ventrix staff see everything; customer roles are
// always scoped to their own organization, no matter what.
const getAssets = async (req, res) => {
  try {
    const orgId = isCustomerRole(req.user.role) ? req.user.organizationId : (req.query.organizationId || null);
    const assets = await assetModel.getAllAssets(orgId);
    res.status(200).json({ success: true, data: assets });
  } catch (error) {
    console.error("❌ Failed to fetch assets:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch assets" });
  }
};

// GET /api/assets/:code
const getAsset = async (req, res) => {
  try {
    const { code } = req.params;
    const asset = await assetModel.findAssetByCode(code);

    if (!asset) {
      return res.status(404).json({ success: false, message: `No asset found for code '${code}'` });
    }
    if (isCustomerRole(req.user.role) && asset.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Not your organization's asset" });
    }

    res.status(200).json({ success: true, data: asset });
  } catch (error) {
    console.error("❌ Failed to fetch asset:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch asset" });
  }
};

// POST /api/assets — Ventrix staff only; registers hardware into coach hierarchy
const createAsset = async (req, res) => {
  try {
    const { asset_code, name } = req.body;

    if (!asset_code || !name) {
      return res.status(400).json({ success: false, message: "asset_code and name are required" });
    }

    const existing = await assetModel.findAssetByCode(asset_code);
    if (existing) {
      return res.status(400).json({ success: false, message: `Asset code '${asset_code}' already exists` });
    }

    if (req.body.status && !assetModel.VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${assetModel.VALID_STATUSES.join(", ")}`,
      });
    }

    const asset = await assetModel.createAsset(req.body);

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "ASSET_CREATED",
      entityType: "ASSET",
      entityId: asset.asset_code,
      newData: asset,
    });

    res.status(201).json({ success: true, message: "Asset created", data: asset });
  } catch (error) {
    console.error("❌ Failed to create asset:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to create asset" });
  }
};

// PUT /api/assets/:code
const updateAsset = async (req, res) => {
  try {
    const { code } = req.params;
    const existing = await assetModel.findAssetByCode(code);
    if (!existing) {
      return res.status(404).json({ success: false, message: `No asset found for code '${code}'` });
    }

    // Organization ownership guard
    if (isCustomerRole(req.user.role) && existing.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Cannot edit assets from another organization" });
    }

    if (req.body.status && !assetModel.VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${assetModel.VALID_STATUSES.join(", ")}`,
      });
    }

    const asset = await assetModel.updateAsset(code, req.body);

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "ASSET_UPDATED",
      entityType: "ASSET",
      entityId: code,
      oldData: existing,
      newData: asset,
    });

    res.status(200).json({ success: true, message: "Asset updated", data: asset });
  } catch (error) {
    console.error("❌ Failed to update asset:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to update asset" });
  }
};

// PATCH /api/assets/:code/status
const updateStatus = async (req, res) => {
  try {
    const { code } = req.params;
    const { status } = req.body;

    if (!status || !assetModel.VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status is required and must be one of: ${assetModel.VALID_STATUSES.join(", ")}`,
      });
    }

    const existing = await assetModel.findAssetByCode(code);
    if (!existing) {
      return res.status(404).json({ success: false, message: `No asset found for code '${code}'` });
    }

    // Organization ownership guard
    if (isCustomerRole(req.user.role) && existing.organization_id !== req.user.organizationId) {
      return res.status(403).json({ success: false, message: "Cannot change status of another organization's asset" });
    }

    const asset = await assetModel.updateAssetStatus(code, status);

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "ASSET_STATUS_CHANGED",
      entityType: "ASSET",
      entityId: code,
      oldData: { status: existing.status },
      newData: { status: asset.status },
    });

    res.status(200).json({ success: true, message: "Status updated", data: asset });
  } catch (error) {
    console.error("❌ Failed to update asset status:", error.message);
    res.status(500).json({ success: false, message: "Failed to update asset status" });
  }
};

module.exports = { getAssets, getAsset, createAsset, updateAsset, updateStatus };
