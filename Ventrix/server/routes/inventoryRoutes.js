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

// Protected by inventory.manage dynamic permission
router.use(verifyToken, requirePermission("inventory.manage"));

router.get("/categories", categories.getAll);
router.post("/categories", categories.create);
router.put("/categories/:id", categories.update);
router.delete("/categories/:id", categories.remove);

router.get("/parts", getPartsWithStock);
router.get("/parts/:id", parts.getById);
router.post("/parts", parts.create);
router.put("/parts/:id", parts.update);
router.delete("/parts/:id", parts.remove);

router.get("/stock/:partId", getStockForPart);
router.post("/stock/adjust", adjustStock);

router.get("/transactions/:partId", getTransactionsForPart);

module.exports = router;
