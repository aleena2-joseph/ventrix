const pool = require("../config/db");

const getAllLocations = async () => {
  const result = await pool.query(
    "SELECT * FROM locations ORDER BY type ASC, name ASC"
  );
  return result.rows;
};

const findLocationByName = async (name) => {
  const result = await pool.query(
    "SELECT * FROM locations WHERE LOWER(name) = LOWER($1)",
    [name.trim()]
  );
  return result.rows[0];
};

const createLocation = async ({ name, code, type, description }) => {
  const cleanName = name.trim();
  const cleanCode = code ? code.trim().toUpperCase() : null;
  const cleanType = type ? type.trim().toUpperCase() : "DEPOT";
  const cleanDesc = description ? description.trim() : null;

  const result = await pool.query(
    `INSERT INTO locations (name, code, type, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [cleanName, cleanCode, cleanType, cleanDesc]
  );
  return result.rows[0];
};

const deleteLocation = async (id) => {
  const result = await pool.query(
    "DELETE FROM locations WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0];
};

module.exports = {
  getAllLocations,
  findLocationByName,
  createLocation,
  deleteLocation,
};
