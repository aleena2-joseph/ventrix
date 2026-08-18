const express = require("express");
const router = express.Router();

const { getAssets, getAsset, createAsset, updateAsset, updateStatus } = require("../controllers/assetController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");

router.use(verifyToken);

// Reads: Requires assets.view permission (auto-scoped inside controller for customer roles)
router.get("/", requirePermission("assets.view"), getAssets);
router.get("/:code", requirePermission("assets.view"), getAsset);

// Writes: Requires assets.manage permission
router.post("/", requirePermission("assets.manage"), createAsset);
router.put("/:code", requirePermission("assets.manage"), updateAsset);
router.patch("/:code/status", requirePermission("assets.manage"), updateStatus);

module.exports = router;
