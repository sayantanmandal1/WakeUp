const cache = require("./cache");
const { bulkUpdatePingStatus } = require("./db");

// SECURITY_NOTE: Pinger uses native fetch (Node 18+) to avoid extra dependencies.
// All requests have a 10-second timeout to prevent hanging connections.
// Errors are caught per-site so one failure doesn't block others.

let pingInterval = null;

async function pingSite(site) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const start = Date.now();
    const response = await fetch(site.url, { signal: controller.signal });
    const duration = Date.now() - start;
    console.log(
      `[PING] ${site.url} -> ${response.status} (${duration}ms)`
    );

    // Batch DB update — only write lastPingedAt/lastStatus periodically
    // to reduce writes. We update in-memory instantly but DB every 5 minutes.
    return { id: site.id, status: response.status, duration };
  } catch (err) {
    console.log(`[PING] ${site.url} -> FAILED (${err.message})`);
    return { id: site.id, status: 0, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function pingAll() {
  const sites = cache.getAll().filter((s) => s.status === "active");
  if (sites.length === 0) {
    console.log("[PINGER] No active websites to ping");
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
}

function startPinger() {
  console.log("[PINGER] Starting — pinging every 30 seconds");
  // Initial ping on startup
  pingAll();
  // Then every 30 seconds
  pingInterval = setInterval(pingAll, 30000);
}

function stopPinger() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
    console.log("[PINGER] Stopped");
  }
}

module.exports = { startPinger, stopPinger };
