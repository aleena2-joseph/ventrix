const express = require("express");
const router = express.Router();

const {
  getSchedules,
  createSchedule,
  updateSchedule,
  getWorkOrders,
  createWorkOrder,
  updateWorkOrderStatus,
  acceptWorkOrder,
  submitCompletionReport,
  verifyAndCloseWorkOrder,
  addFindingToWorkOrder,
  checkTechnicianAvailability,
  useWorkOrderPart,
  getWorkOrderParts,
  getAssetMaintenanceSummaries,
  getAssetMaintenanceHistory,
} = require("../controllers/maintenanceController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");

router.use(verifyToken);

// Reads: Requires maintenance.view permission
router.get("/schedules", requirePermission("maintenance.view"), getSchedules);
router.get("/assets-summary", requirePermission("maintenance.view"), getAssetMaintenanceSummaries);
router.get("/assets/:assetCode/history", requirePermission("maintenance.view"), getAssetMaintenanceHistory);
router.get("/work-orders", requirePermission("maintenance.view"), getWorkOrders);
router.get("/work-orders/:id/parts", requirePermission("maintenance.view"), getWorkOrderParts);
router.get("/technicians/:id/availability", requirePermission("maintenance.view"), checkTechnicianAvailability);

// Writes: Requires maintenance.manage or maintenance.verify permission
router.post("/schedules", requirePermission("maintenance.manage"), createSchedule);
router.patch("/schedules/:id", requirePermission("maintenance.manage"), updateSchedule);
router.post("/work-orders", requirePermission("maintenance.manage"), createWorkOrder);
router.patch("/work-orders/:id/status", requirePermission("maintenance.manage"), updateWorkOrderStatus);
router.patch("/work-orders/:id/accept", requirePermission("maintenance.manage"), acceptWorkOrder);
router.post("/work-orders/:id/accept", requirePermission("maintenance.manage"), acceptWorkOrder);
router.patch("/work-orders/:id/complete", requirePermission("maintenance.manage"), submitCompletionReport);
router.post("/work-orders/:id/complete", requirePermission("maintenance.manage"), submitCompletionReport);
router.post("/work-orders/:id/completion-report", requirePermission("maintenance.manage"), submitCompletionReport);
router.patch("/work-orders/:id/completion-report", requirePermission("maintenance.manage"), submitCompletionReport);
router.patch("/work-orders/:id/verify", requirePermission("maintenance.verify"), verifyAndCloseWorkOrder);
router.post("/work-orders/:id/verify", requirePermission("maintenance.verify"), verifyAndCloseWorkOrder);
router.post("/work-orders/:id/verify-and-close", requirePermission("maintenance.verify"), verifyAndCloseWorkOrder);
router.patch("/work-orders/:id/verify-and-close", requirePermission("maintenance.verify"), verifyAndCloseWorkOrder);
router.post("/work-orders/:id/findings", requirePermission("maintenance.manage"), addFindingToWorkOrder);
router.post("/work-orders/:id/parts", requirePermission("maintenance.manage"), useWorkOrderPart);

module.exports = router;
