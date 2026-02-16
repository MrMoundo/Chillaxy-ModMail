const System = require("../../System/System");
const { loadData, saveData } = require("../data/store");

async function cleanupRemovedGuilds() {
  const data = loadData();
  const now = Date.now();
  const cutoff = System.defaults.removeDataAfterDays * 86_400_000;
  for (const [guildId, meta] of Object.entries(data.guilds || {})) {
    if (meta?.removedAt && now - meta.removedAt > cutoff) {
      delete data.tickets[guildId];
      delete data.guilds[guildId];
    }
  }
  saveData(data);
}

async function cleanupTemporaryBlacklists() {
  const data = loadData();
  const now = Date.now();
  let changed = false;
  for (const [guildId, entry] of Object.entries(data.blacklist || {})) {
    if (!entry?.temporary) continue;
    for (const [userId, item] of Object.entries(entry.temporary)) {
      if (!item?.expiresAt || item.expiresAt <= now) {
        delete entry.temporary[userId];
        changed = true;
      }
    }
  }
  if (changed) saveData(data);
}

function startCleanupIntervals(closeIdleTickets) {
  setInterval(async () => {
    await closeIdleTickets();
  }, 60_000);

  setInterval(async () => {
    await cleanupRemovedGuilds();
  }, 86_400_000);

  setInterval(async () => {
    await cleanupTemporaryBlacklists();
  }, 60_000);
}

module.exports = { startCleanupIntervals };
