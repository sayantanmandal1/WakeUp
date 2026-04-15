const cache = require("./cache");
const { bulkUpdatePingStatus } = require("./db");

// STRATEGY:
// - Any HTTP response (200, 404, 429, etc.) from Render means the server process
//   is running. Even a 404 resets Render's 15-min inactivity sleep timer.
// - The ONLY case where a server is truly sleeping is when we get a connection
//   timeout or Render returns 502/503 (bad gateway = app not running).
// - For sleeping servers: we wait for the cold start to finish (up to 120s),
//   then confirm it's awake with a second request.
// - Ping cycle every 14 minutes (under Render's 15-min sleep threshold).
// - To keep WakeUp itself alive, add its own URL as a website in the dashboard.

const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes — safely under Render's 15-min sleep
const REQUEST_TIMEOUT = 120000;        // 120s — enough for cold starts
const COLD_START_STATUSES = new Set([502, 503, 0]); // 0 = fetch failed/timeout

let pingTimer = null;
let isPinging = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "WakeUp-Pinger/1.0",
        Accept: "text/html,application/json,*/*",
      },
    });
    // Fully consume body to complete the HTTP cycle
    await response.text();
    return { status: response.status, ok: true };
  } catch (err) {
    return { status: 0, error: err.message, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function pingSite(site) {
  const start = Date.now();
  const result = await fetchWithTimeout(site.url, REQUEST_TIMEOUT);
  const duration = Date.now() - start;

  // Server responded with anything other than 502/503/timeout = it's alive.
  // 404, 429, 401, etc. are all fine — the process is running.
  if (!COLD_START_STATUSES.has(result.status)) {
    console.log(`[PING] ${site.url} -> ${result.status} (${duration}ms) ✓ alive`);
    return { id: site.id, status: result.status, duration };
  }

  // Server is likely sleeping (502/503) or unreachable (0/timeout).
  // The first request already triggered the cold start on Render.
  // Wait for it to boot, then confirm with a second request.
  console.log(
    `[PING] ${site.url} -> ${result.status || "TIMEOUT"} (${duration}ms) — cold start triggered, waiting 30s...`
  );
  await delay(30000);

  // Second request — server should be awake by now
  const retryStart = Date.now();
  const retry = await fetchWithTimeout(site.url, REQUEST_TIMEOUT);
  const retryDuration = Date.now() - retryStart;

  if (!COLD_START_STATUSES.has(retry.status)) {
    console.log(
      `[PING] ${site.url} -> ${retry.status} (${retryDuration}ms) ✓ woke up after retry`
    );
  } else {
    console.log(
      `[PING] ${site.url} -> ${retry.status || "TIMEOUT"} (${retryDuration}ms) ✗ still not responding`
    );
  }

  return { id: site.id, status: retry.status, duration: retryDuration };
}

async function pingAll() {
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

  const timestamp = new Date().toISOString();
  console.log(`[PINGER] ${timestamp} — Pinging ${sites.length} websites...`);

  // Ping sequentially — each site fully handled before the next
  const updates = [];
  for (const site of sites) {
    try {
      const result = await pingSite(site);
      updates.push({ id: result.id, status: result.status });
    } catch (err) {
      console.error(`[PINGER] Unexpected error for ${site.url}:`, err.message);
    }
  }

  if (updates.length > 0) {
    try {
      await bulkUpdatePingStatus(updates);
    } catch (err) {
      console.error("[PINGER] DB update failed:", err.message);
    }
  }

  console.log(`[PINGER] Cycle complete. Next ping in ${PING_INTERVAL / 60000} minutes.`);
  isPinging = false;
}

function startPinger() {
  console.log(`[PINGER] Starting — ping cycle every ${PING_INTERVAL / 60000} minutes`);
  console.log(`[PINGER] TIP: Add this server's own URL as a website to keep it alive on Render`);

  // Initial ping on startup
  pingAll();

  // Regular ping cycle
  pingTimer = setInterval(pingAll, PING_INTERVAL);
}

function stopPinger() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
    console.log("[PINGER] Stopped");
  }
}

module.exports = { startPinger, stopPinger };