const express = require("express");
const router = express.Router();

const { getAlerts, createAlert, resolveAlert } = require("../controllers/alertController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");

router.use(verifyToken);

router.get("/", requirePermission("alerts.view"), getAlerts);
router.post("/", requirePermission("alerts.manage"), createAlert);
router.patch("/:id/resolve", requirePermission("alerts.manage"), resolveAlert);

module.exports = router;
