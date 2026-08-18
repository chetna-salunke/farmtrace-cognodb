const express = require("express");
const { runQuery } = require("../db");
const queries = require("../queries");

const router = express.Router();

// GET /api/recalls — list all recall events with their origin farm.
router.get("/", async (req, res, next) => {
  try {
    const rows = await runQuery(queries.listRecalls);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/recalls/:id/impact — the core multi-hop traversal: everything
// downstream of a recall (Farm -> Ingredient -> Dish -> Restaurant).
router.get("/:id/impact", async (req, res, next) => {
  try {
    const [summary, impactRows] = await Promise.all([
      runQuery(queries.recallSummary, { recallId: req.params.id }),
      runQuery(queries.recallImpact, { recallId: req.params.id }),
    ]);

    if (!summary.length || !summary[0].recall) {
      return res.status(404).json({ error: "Recall not found" });
    }

    res.json({
      recall: summary[0].recall,
      farm: summary[0].farm,
      dishesAffected: summary[0].dishesAffected?.toNumber
        ? summary[0].dishesAffected.toNumber()
        : summary[0].dishesAffected,
      restaurantsAffected: summary[0].restaurantsAffected?.toNumber
        ? summary[0].restaurantsAffected.toNumber()
        : summary[0].restaurantsAffected,
      rows: impactRows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
