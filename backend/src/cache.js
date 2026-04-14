// SECURITY_NOTE: In-memory cache to minimize database read/write operations.
// URLs are loaded once on startup and updated only on insert/delete.
// The cron job reads ONLY from this cache, never hitting the DB.

let websites = [];

function getAll() {
  return [...websites];
}

function setAll(list) {
  websites = list.map((w) => ({
    id: w.id,
    url: w.url,
    status: w.status,
  }));
}

function add(website) {
  websites.unshift({
    id: website.id,
    url: website.url,
    status: website.status,
  });
}

function remove(id) {
  websites = websites.filter((w) => w.id !== id);
}

function updateStatus(id, status) {
  const site = websites.find((w) => w.id === id);
  if (site) site.status = status;
}

module.exports = { getAll, setAll, add, remove, updateStatus };
