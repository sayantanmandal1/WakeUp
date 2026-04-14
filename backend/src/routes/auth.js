const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

// SECURITY_NOTE: Credentials are read from environment variables, not hardcoded.
// In production, set ADMIN_USERNAME and ADMIN_PASSWORD via env vars / secret manager.

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    return res.json({ token, username });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

module.exports = router;
