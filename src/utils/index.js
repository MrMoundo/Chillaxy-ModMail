const { PermissionsBitField } = require("discord.js");

function getLocale(lang) {
  return ["ar", "en"].includes(lang) ? lang : "ar";
}

function isManager(member, config) {
  if (!member) return false;
  if (config.ownerUserId && member.id === config.ownerUserId) return true;
  if (config.adminRoleId) {
    return member.roles.cache.has(config.adminRoleId);
  }
  return member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}

function hasAdminRole(member, config) {
  if (!member || !config?.adminRoleId) return false;
  return member.roles.cache.has(config.adminRoleId);
}

function isServerOwner(guild, userId) {
  if (!guild || !userId) return false;
  return guild.ownerId === userId;
}

function isSupport(member, config) {
  if (!member) return false;
  if (!config.supportRoleIds.length) return member.permissions.has("ManageGuild");
  return config.supportRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

function appendRateLimit(inMemory, userId) {
  const now = Date.now();
  const entries = inMemory.rateLimit.get(userId) || [];
  const updated = entries.filter((time) => now - time < 60_000);
  updated.push(now);
  inMemory.rateLimit.set(userId, updated);
  return updated.length;
}

function appendTicketOpen(inMemory, userId) {
  const now = Date.now();
  const entries = inMemory.ticketOpenCount.get(userId) || [];
  const updated = entries.filter((time) => now - time < 86_400_000);
  updated.push(now);
  inMemory.ticketOpenCount.set(userId, updated);
  return updated.length;
}

function createTicketId() {
  return `T-${Date.now().toString(36).toUpperCase()}`;
}

function formatEta(minutes) {
  if (minutes <= 1) return "1 minute";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return `${hours}h ${remain}m`;
}

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

function normalizeHexColor(input, fallback = "#5865F2") {
  if (typeof input !== "string") return fallback;
  const hex = input.trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return fallback;
  return hex.toUpperCase();
}

function colorToInt(hex) {
  return Number.parseInt(hex.replace("#", ""), 16);
}

function shiftColor(hex, amount) {
  const normalized = normalizeHexColor(hex);
  const value = colorToInt(normalized);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  const adjust = (channel) => Math.max(0, Math.min(255, Math.round(channel + 255 * amount)));
  return (adjust(r) << 16) | (adjust(g) << 8) | adjust(b);
}

function resolveEmbedColor(config, variant = "primary") {
  const base = normalizeHexColor(config?.embedColor);
  const shifts = {
    primary: 0,
    info: -0.12,
    success: 0.08,
    warning: 0.16,
    danger: -0.2,
    neutral: -0.28,
  };
  return shiftColor(base, shifts[variant] ?? 0);
}

function formatDurationMs(ms) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

async function deleteUserMessage(user, messageId) {
  if (!user || !messageId) return;
  const dm = await user.createDM().catch(() => null);
  if (!dm) return;
  const msg = await dm.messages.fetch(messageId).catch(() => null);
  if (!msg) return;
  await msg.delete().catch(() => null);
}

async function ensureThread(channel, name) {
  return channel.threads.create({
    name,
    autoArchiveDuration: 1440,
  });
}

module.exports = {
  getLocale,
  isManager,
  hasAdminRole,
  isServerOwner,
  isSupport,
  appendRateLimit,
  appendTicketOpen,
  createTicketId,
  formatEta,
  randomColor,
  normalizeHexColor,
  resolveEmbedColor,
  formatDurationMs,
  deleteUserMessage,
  ensureThread,
};
