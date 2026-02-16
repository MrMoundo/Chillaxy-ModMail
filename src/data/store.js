const fs = require("fs");
const System = require("../../System/System");

function loadData() {
  if (!fs.existsSync(System.dataFile)) {
    return { tickets: {}, guilds: {}, blacklist: {}, primaryGuildId: "", nextTicketNumber: 1 };
  }
  try {
    const raw = fs.readFileSync(System.dataFile, "utf-8");
    return raw
      ? JSON.parse(raw)
      : { tickets: {}, guilds: {}, blacklist: {}, primaryGuildId: "", nextTicketNumber: 1 };
  } catch (error) {
    return { tickets: {}, guilds: {}, blacklist: {}, primaryGuildId: "", nextTicketNumber: 1 };
  }
}

function saveData(data) {
  fs.writeFileSync(System.dataFile, JSON.stringify(data, null, 2));
}

function ensureGuild(data, guildId) {
  if (!data.tickets[guildId]) {
    data.tickets[guildId] = {};
  }
  if (!data.guilds) data.guilds = {};
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = { removedAt: null };
  }
  if (!data.guilds[guildId].supportStats) {
    data.guilds[guildId].supportStats = {};
  }
  if (!data.blacklist) data.blacklist = {};
  if (!data.blacklist[guildId]) {
    data.blacklist[guildId] = { permanent: {}, temporary: {} };
  }
}

function pruneExpiredBlacklist(data, guildId) {
  if (!data.blacklist?.[guildId]?.temporary) return;
  const now = Date.now();
  const temp = data.blacklist[guildId].temporary;
  let changed = false;
  for (const [userId, entry] of Object.entries(temp)) {
    if (!entry?.expiresAt || entry.expiresAt <= now) {
      delete temp[userId];
      changed = true;
    }
  }
  if (changed) saveData(data);
}

function getGuildConfig(guildId) {
  const data = loadData();
  const stored = data.guilds?.[guildId]?.config || {};
  return { ...System.defaults, ...(System.guilds[guildId] || {}), ...stored };
}

function getPrimaryGuildId(client) {
  const data = loadData();
  if (data.primaryGuildId) return data.primaryGuildId;
  if (System.defaults.primaryGuildId) return System.defaults.primaryGuildId;
  return client.guilds.cache.first()?.id || null;
}

module.exports = {
  loadData,
  saveData,
  ensureGuild,
  pruneExpiredBlacklist,
  getGuildConfig,
  getPrimaryGuildId,
};
