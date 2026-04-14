const cache = require("./cache");
const { bulkUpdatePingStatus } = require("./db");

// SECURITY_NOTE: Pinger uses native fetch (Node 18+) to avoid extra dependencies.
// Timeout set to 120s to survive Render/free-tier cold starts (~30-60s).
// Response body is fully consumed to ensure the server completes the wake cycle.
// Errors are caught per-site so one failure doesn't block others.

async function pingSite(site) {
  const controller = new AbortController();
  // 120s timeout — free-tier cold starts can take 60+ seconds
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const start = Date.now();
    const response = await fetch(site.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "WakeUp-Pinger/1.0",
        Accept: "*/*",
      },
    });
    // Consume the full response body so the TCP connection completes
    // and the target server fully processes the request
    await response.text();
    const duration = Date.now() - start;
    console.log(
      `[PING] ${site.url} -> ${response.status} (${duration}ms)`
    );

    return { id: site.id, status: response.status, duration };
  } catch (err) {
    const duration = Date.now() - Date.now();
    console.log(`[PING] ${site.url} -> FAILED (${err.message})`);
    // If it was a timeout, the server might still be waking up — that's ok,
    // the next cycle will catch it once it's up
    return { id: site.id, status: 0, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

let pingTimer = null;
let isPinging = false;

async function pingAll() {
  // Prevent overlapping ping cycles (cold starts can take 60+ seconds)
  if (isPinging) {
    console.log("[PINGER] Previous cycle still running, skipping");
    return;
  }
  isPinging = true;

  const sites = cache.getAll().filter((s) => s.status === "active");
  if (sites.length === 0) {
    console.log("[PINGER] No active websites to ping");
    isPinging = false;
    return;
  }

  console.log(`[PINGER] Pinging ${sites.length} websites...`);
  const results = await Promise.allSettled(sites.map(pingSite));

  // Batch update lastPingedAt in DB (single transaction instead of N writes)
  const updates = results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => ({ id: r.value.id, status: r.value.status }));

  if (updates.length > 0) {
    try {
      await bulkUpdatePingStatus(updates);
    } catch (err) {
      console.error("[PINGER] Bulk update failed:", err.message);
    }
  }

  isPinging = false;
}

function startPinger() {
  console.log("[PINGER] Starting — pinging every 30 seconds");
  // Initial ping on startup
  pingAll();
  // Then every 30 seconds
  pingTimer = setInterval(pingAll, 30000);
}

function stopPinger() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
    console.log("[PINGER] Stopped");
  }
}

module.exports = { startPinger, stopPinger };