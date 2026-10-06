const express = require("express");
const router = express.Router();
const locationController = require("../controllers/locationController");
const { verifyToken } = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");

// All authenticated users can view locations to populate dropdowns
router.get("/", verifyToken, locationController.getLocations);

// Only administrators can add or delete railway locations/depots
router.post("/", verifyToken, requireRole("ADMIN", "VENTRIX_ADMIN"), locationController.createLocation);
router.delete("/:id", verifyToken, requireRole("ADMIN", "VENTRIX_ADMIN"), locationController.deleteLocation);

module.exports = router;
