const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");

const { verifyConnectivity, closeDriver } = require("./db");
const farmsRouter = require("./routes/farms");
const restaurantsRouter = require("./routes/restaurants");
const dishesRouter = require("./routes/dishes");
const recallsRouter = require("./routes/recalls");
const ingredientsRouter = require("./routes/ingredients");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve the static frontend (plain HTML/CSS/JS — no build step required).
app.use(express.static(path.join(__dirname, "..", "frontend")));

let dbHealthy = false;

// Health endpoint is intentionally registered BEFORE the gate below, so it
// always answers (with the real status) instead of being swallowed by the
// 503 shortcut.
app.get("/api/health", (req, res) => {
  res.json({ status: dbHealthy ? "ok" : "db_unreachable" });
});

// Every other API route is gated on a quick health flag so the app fails
// predictably (a clean 503 + message) instead of hanging or crashing when
// CognoDB is unreachable — e.g. free-tier instance paused, wrong password,
// network blip.
app.use("/api", (req, res, next) => {
  if (!dbHealthy) {
    return res.status(503).json({
      error: "Database unavailable",
      message:
        "FarmTrace can't reach CognoDB right now. Check that your instance is running and COGNODB_URI / COGNODB_PASSWORD in .env are correct.",
    });
  }
  next();
});

app.use("/api/farms", farmsRouter);
app.use("/api/restaurants", restaurantsRouter);
app.use("/api/dishes", dishesRouter);
app.use("/api/recalls", recallsRouter);
app.use("/api/ingredients", ingredientsRouter);

// Centralized error handler — never leak stack traces to the client.
app.use((err, req, res, next) => {
  console.error("[error]", err.message);
  res.status(500).json({
    error: "Internal server error",
    message: "Something went wrong processing that request.",
  });
});

async function start() {
  try {
    await verifyConnectivity();
    dbHealthy = true;
    console.log("[db] Connected to CognoDB");
  } catch (err) {
    dbHealthy = false;
    console.error(
      "[db] Could not connect to CognoDB at startup:",
      err.message
    );
    console.error(
      "[db] The server will still start, but /api routes will return 503 until the database is reachable."
    );
  }

  // Retry connectivity in the background every 15s if it started unhealthy,
  // so the app self-heals once CognoDB comes back without a restart.
  const healthPoll = setInterval(async () => {
    if (dbHealthy) return;
    try {
      await verifyConnectivity();
      dbHealthy = true;
      console.log("[db] Reconnected to CognoDB");
    } catch {
      // still down — stay quiet, try again next tick
    }
  }, 15_000);

  const server = app.listen(PORT, () => {
    console.log(`FarmTrace API listening on http://localhost:${PORT}`);
  });

  process.on("SIGINT", async () => {
    clearInterval(healthPoll);
    server.close();
    await closeDriver();
    process.exit(0);
  });
}

start();
