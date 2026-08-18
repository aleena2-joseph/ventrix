const express = require("express");
const router = express.Router();

const {
  getServiceRequests,
  createServiceRequest,
  updateServiceRequestStatus,
} = require("../controllers/serviceRequestController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");

router.use(verifyToken);

router.get("/", requirePermission("service_requests.view"), getServiceRequests);
router.post("/", requirePermission("service_requests.create"), createServiceRequest);
router.patch("/:id/status", requirePermission("service_requests.manage"), updateServiceRequestStatus);

module.exports = router;
