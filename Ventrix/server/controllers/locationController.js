const locationModel = require("../models/locationModel");
const auditModel = require("../models/auditModel");

// GET /api/locations — List all locations (accessible to all authenticated users for dropdown selection)
const getLocations = async (req, res) => {
  try {
    const locations = await locationModel.getAllLocations();
    res.status(200).json({ success: true, data: locations });
  } catch (error) {
    console.error("❌ Failed to fetch locations:", error.message);
    res.status(500).json({ success: false, message: "Failed to fetch locations" });
  }
};

// POST /api/locations — Admin only: create a new depot / workshop / coach location
const createLocation = async (req, res) => {
  try {
    const { name, code, type, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Location name is required" });
    }

    const existing = await locationModel.findLocationByName(name);
    if (existing) {
      return res.status(400).json({ success: false, message: `Location '${name}' already exists` });
    }

    const location = await locationModel.createLocation({ name, code, type, description });

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "LOCATION_CREATED",
      entityType: "LOCATION",
      entityId: String(location.id),
      newData: location,
    });

    res.status(201).json({ success: true, message: "Location created successfully", data: location });
  } catch (error) {
    console.error("❌ Failed to create location:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to create location" });
  }
};

// DELETE /api/locations/:id — Admin only: remove a location
const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await locationModel.deleteLocation(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Location not found" });
    }

    await auditModel.logAction({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      action: "LOCATION_DELETED",
      entityType: "LOCATION",
      entityId: String(id),
      previousData: deleted,
    });

    res.status(200).json({ success: true, message: "Location removed successfully" });
  } catch (error) {
    console.error("❌ Failed to delete location:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to delete location" });
  }
};

module.exports = {
  getLocations,
  createLocation,
  deleteLocation,
};
