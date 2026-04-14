const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const { initDB, getAllWebsites } = require("./db");
const cache = require("./cache");
const { startPinger } = require("./pinger");
const authRoutes = require("./routes/auth");
const websiteRoutes = require("./routes/websites");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// SECURITY_NOTE: CORS is restricted to the frontend origin only.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
].filter(Boolean);

// Check if wildcard is set
const allowAllOrigins = process.env.FRONTEND_URL === "*";

app.use(
  cors({
    origin: function (origin, callback) {
      if (allowAllOrigins) {
        callback(null, true);
      } else if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/websites", websiteRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Initialize DB, load cache, start pinger
async function start() {
  try {
    console.log("[DB] Connecting to PostgreSQL...");
    await initDB();
    console.log("[DB] Connected to PostgreSQL");

    // Single DB read on startup — load all websites into memory cache
    const websites = await getAllWebsites();
    cache.setAll(websites);
    console.log(`[CACHE] Loaded ${websites.length} websites into memory`);

    // Start the pinger (interval-based, every 30s)
    startPinger();

    app.listen(PORT, () => {
      console.log(`[SERVER] WakeUp backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error("[FATAL] Failed to start:", err);
    process.exit(1);
  }
}

start();
