const express = require("express");
const { runQuery } = require("../db");
const queries = require("../queries");

const router = express.Router();

// GET /api/dishes — list all dishes.
router.get("/", async (req, res, next) => {
  try {
    const rows = await runQuery(queries.listDishes);
    res.json(rows.map((r) => r.d));
  } catch (err) {
    next(err);
  }
});

// GET /api/dishes/search?q=term
router.get("/search", async (req, res, next) => {
  try {
    const term = (req.query.q || "").trim();
    if (!term) return res.json([]);
    const rows = await runQuery(queries.searchDishes, { term });
    res.json(rows.map((r) => r.d));
  } catch (err) {
    next(err);
  }
});

// GET /api/dishes/:id/trace — full farm-to-plate trace for one dish.
router.get("/:id/trace", async (req, res, next) => {
  try {
    const rows = await runQuery(queries.dishTrace, { dishId: req.params.id });
    if (!rows.length || !rows[0].dish) {
      return res.status(404).json({ error: "Dish not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/dishes/:id/allergen-substitutes?allergen=Peanuts
router.get("/:id/allergen-substitutes", async (req, res, next) => {
  try {
    const allergen = req.query.allergen;
    if (!allergen) {
      return res.status(400).json({ error: "Query param 'allergen' is required" });
    }
    const rows = await runQuery(queries.allergenSafeSubstitutes, {
      dishId: req.params.id,
      allergen,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
