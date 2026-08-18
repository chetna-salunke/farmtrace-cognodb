const express = require("express");
const { runQuery } = require("../db");
const queries = require("../queries");

const router = express.Router();

// GET /api/ingredients/search?q=term
router.get("/search", async (req, res, next) => {
  try {
    const term = (req.query.q || "").trim();
    if (!term) return res.json([]);
    const rows = await runQuery(queries.searchIngredients, { term });
    res.json(rows.map((r) => r.i));
  } catch (err) {
    next(err);
  }
});

// GET /api/ingredients/:id/exposure — every dish/restaurant that uses this
// ingredient, plus the farms it comes from.
router.get("/:id/exposure", async (req, res, next) => {
  try {
    const rows = await runQuery(queries.ingredientExposure, {
      ingredientId: req.params.id,
    });
    if (!rows.length || !rows[0].ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
