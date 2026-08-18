const express = require("express");
const { runQuery } = require("../db");
const queries = require("../queries");

const router = express.Router();

// GET /api/restaurants — list all restaurants with dish counts.
router.get("/", async (req, res, next) => {
  try {
    const rows = await runQuery(queries.listRestaurants);
    res.json(rows.map((r) => r.restaurant));
  } catch (err) {
    next(err);
  }
});

// GET /api/restaurants/:id/shared-risk — restaurants sharing farms with this one.
router.get("/:id/shared-risk", async (req, res, next) => {
  try {
    const rows = await runQuery(queries.sharedSupplyRisk, {
      restaurantId: req.params.id,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
