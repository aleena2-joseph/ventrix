const express = require("express");
const router = express.Router();

const {
  getSchedules,
  createSchedule,
  getWorkOrders,
  createWorkOrder,
  updateWorkOrderStatus,
  useWorkOrderPart,
  getWorkOrderParts,
} = require("../controllers/maintenanceController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");

router.use(verifyToken);

// Reads: Requires maintenance.view permission
router.get("/schedules", requirePermission("maintenance.view"), getSchedules);
router.get("/work-orders", requirePermission("maintenance.view"), getWorkOrders);
router.get("/work-orders/:id/parts", requirePermission("maintenance.view"), getWorkOrderParts);

// Writes: Requires maintenance.manage permission
router.post("/schedules", requirePermission("maintenance.manage"), createSchedule);
router.post("/work-orders", requirePermission("maintenance.manage"), createWorkOrder);
router.patch("/work-orders/:id/status", requirePermission("maintenance.manage"), updateWorkOrderStatus);
router.post("/work-orders/:id/parts", requirePermission("maintenance.manage"), useWorkOrderPart);

module.exports = router;
