const express = require("express");
const { runQuery } = require("../db");
const queries = require("../queries");

const router = express.Router();

// GET /api/farms — list all farms with ingredient counts.
router.get("/", async (req, res, next) => {
  try {
    const rows = await runQuery(queries.listFarms);
    res.json(rows.map((r) => r.farm));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
