const express = require("express");
const router = express.Router();
const { getFleetHierarchy, getCoachDigitalTwin } = require("../controllers/fleetController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");

router.use(verifyToken);

// Reads require fleet.view or assets.view
router.get("/hierarchy", requirePermission("assets.view"), getFleetHierarchy);
router.get("/coaches/:id/twin", requirePermission("assets.view"), getCoachDigitalTwin);

module.exports = router;
