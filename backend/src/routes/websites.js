const express = require("express");
const { addWebsite, deleteWebsite, toggleWebsite } = require("../db");
const cache = require("../cache");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/websites — read from cache (zero DB reads)
router.get("/", (req, res) => {
  const websites = cache.getAll();
  res.json(websites);
});

// POST /api/websites — write to DB + update cache (1 DB write)
router.post("/", async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Normalize URL
    url = url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    const existing = cache.getAll().find((w) => w.url === url);
    if (existing) {
      return res.status(409).json({ error: "Website already exists" });
    }

    const website = await addWebsite(url);
    cache.add(website);

    res.status(201).json(website);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Website already exists" });
    }
    console.error("Error adding website:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/websites/:id — delete from DB + update cache (1 DB write)
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await deleteWebsite(id);
    cache.remove(id);
    res.json({ message: "Website removed" });
  } catch (err) {
    console.error("Error deleting website:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/websites/:id/toggle — toggle active/inactive
router.patch("/:id/toggle", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const sites = cache.getAll();
    const site = sites.find((w) => w.id === id);
    if (!site) return res.status(404).json({ error: "Website not found" });

    const newStatus = site.status === "active" ? "inactive" : "active";
    await toggleWebsite(id, newStatus);
    cache.updateStatus(id, newStatus);

    res.json({ id, status: newStatus });
  } catch (err) {
    console.error("Error toggling website:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
