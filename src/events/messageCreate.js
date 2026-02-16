const { ChannelType } = require("discord.js");
const System = require("../../System/System");
const messages = require("../messages");
const inMemory = require("../state/inMemory");
const { loadData, ensureGuild, getGuildConfig, getPrimaryGuildId, saveData, pruneExpiredBlacklist } = require("../data/store");
const { appendRateLimit, appendTicketOpen, isSupport, formatDurationMs, getLocale } = require("../utils");
const { createTicketService } = require("../services/tickets");
const { createPendingService } = require("../services/pending");
const { buildWelcomeEmbed } = require("../embeds");

function registerMessageCreate(client) {
  const ticketService = createTicketService(client, inMemory);
  const pendingService = createPendingService(inMemory, ticketService.createTicketFromPending);

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (!message.guild && message.channel.type === ChannelType.DM) {
      const data = loadData();
      const rate = appendRateLimit(inMemory, message.author.id);
      const pending = inMemory.pending.get(message.author.id);
      if (pending && (await pendingService.handlePendingFlow(message, data))) {
        return;
      }

      if (rate > System.defaults.maxMessagesPerMinute) {
        await message.author.send(messages.ar.rateLimited).catch(() => null);
        return;
      }
      const guildId = getPrimaryGuildId(client);
      if (!guildId) {
        await message.author.send(messages.ar.setupRequired).catch(() => null);
        return;
      }
      ensureGuild(data, guildId);
      pruneExpiredBlacklist(data, guildId);
      const config = getGuildConfig(guildId);
      const locale = getLocale(config.language);
      const blacklist = data.blacklist?.[guildId];
      const tempEntry = blacklist?.temporary?.[message.author.id];
      if (blacklist?.permanent?.[message.author.id]) {
        await message.author.send(messages[locale].blacklisted).catch(() => null);
        return;
      }
      if (tempEntry?.expiresAt && tempEntry.expiresAt > Date.now()) {
        const duration = formatDurationMs(tempEntry.expiresAt - Date.now());
        const text = messages[locale].tempBlacklisted.replace("{duration}", duration);
        await message.author.send(text).catch(() => null);
        return;
      }
      const ticket = data.tickets[guildId]?.[message.author.id];
      if (ticket?.status === "open") {
        await ticketService.forwardUserMessage(message, ticket, config);
        return;
      }

      const ticketCount = appendTicketOpen(inMemory, message.author.id);
      if (ticketCount > System.defaults.maxTicketsPerDay) {
        await message.author.send(messages.ar.blocked).catch(() => null);
        return;
      }

      const newPending = {
        step: "language",
        language: "ar",
        userId: message.author.id,
        guildId,
        expiresAt: Date.now() + System.defaults.setupTimeoutMinutes * 60_000,
        category: "general",
      };
      inMemory.pending.set(message.author.id, newPending);
      await message.author.send({ embeds: [buildWelcomeEmbed("ar", config)] }).catch(() => null);
      await pendingService.sendPendingPrompt(message.author, newPending);
      return;
    }

    if (message.guild) {
      const config = getGuildConfig(message.guild.id);
      if (message.channel.isThread()) {
        const data = loadData();
        ensureGuild(data, message.guild.id);
        const ticket = Object.values(data.tickets[message.guild.id]).find(
          (entry) => entry.threadId === message.channel.id
        );
        if (!ticket || ticket.status !== "open") return;
        if (!isSupport(message.member, config)) return;
        if (ticket.claimedBy && ticket.claimedBy !== message.author.id) return;

        const user = await client.users.fetch(ticket.userId).catch(() => null);
        if (!user) return;

        const sent = await user.send(message.content).catch(() => null);
        if (!sent) {
          await ticketService.closeTicket({
            guildId: message.guild.id,
            ticket,
            config,
            reason: "dm failed",
          });
          return;
        }
        const supportName = config.supportLabel || "Chillaxy Support";
        const avatar = message.guild.iconURL({ extension: "png", size: 64 }) || message.author.displayAvatarURL({ extension: "png", size: 64 });
        ticket.messages.push({
          from: "staff",
          content: message.content,
          timestamp: Date.now(),
          authorTag: supportName,
          authorId: "support",
          authorAvatar: avatar,
        });
        ticket.lastActivity = Date.now();
        if (!ticket.firstResponseAt) {
          ticket.firstResponseAt = Date.now();
        }
        saveData(data);
      }

      if (message.content.trim().toLowerCase() === "!close") {
        const data = loadData();
        ensureGuild(data, message.guild.id);
        const ticket = Object.values(data.tickets[message.guild.id]).find(
          (entry) => entry.threadId === message.channel.id
        );
        if (!ticket) return;
        if (!isSupport(message.member, config)) return;
        ticket.closedByTag = message.author.tag;
        ticket.closedById = message.author.id;
        await ticketService.closeTicket({
          guildId: message.guild.id,
          ticket,
          config,
          reason: "manual close",
        });
      }
    }
  });
}

module.exports = { registerMessageCreate };
