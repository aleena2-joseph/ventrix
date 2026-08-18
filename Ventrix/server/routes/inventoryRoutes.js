const express = require("express");
const router = express.Router();

const {
  categories,
  parts,
  getPartsWithStock,
  getStockForPart,
  adjustStock,
  getTransactionsForPart,
} = require("../controllers/inventoryController");
const { verifyToken } = require("../middleware/auth");
const { requirePermission } = require("../middleware/roles");

router.use(verifyToken);

// Reads: Require inventory.view
router.get("/categories", requirePermission("inventory.view"), categories.getAll);
router.get("/parts", requirePermission("inventory.view"), getPartsWithStock);
router.get("/parts/:id", requirePermission("inventory.view"), parts.getById);
router.get("/stock/:partId", requirePermission("inventory.view"), getStockForPart);
router.get("/transactions/:partId", requirePermission("inventory.view"), getTransactionsForPart);

// Writes: Require inventory.manage
router.post("/categories", requirePermission("inventory.manage"), categories.create);
router.put("/categories/:id", requirePermission("inventory.manage"), categories.update);
router.delete("/categories/:id", requirePermission("inventory.manage"), categories.remove);

router.post("/parts", requirePermission("inventory.manage"), parts.create);
router.put("/parts/:id", requirePermission("inventory.manage"), parts.update);
router.delete("/parts/:id", requirePermission("inventory.manage"), parts.remove);

router.post("/stock/adjust", requirePermission("inventory.manage"), adjustStock);

module.exports = router;
