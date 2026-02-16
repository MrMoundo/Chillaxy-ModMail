const messages = require("../messages");
const {
  loadData,
  saveData,
  ensureGuild,
  getGuildConfig,
} = require("../data/store");
const {
  buildTicketEmbed,
  buildAwaitingEmbed,
  buildClosedEmbed,
  buildClosedControlsEmbed,
} = require("../embeds");
const {
  dmCloseRow,
  ratingRow,
  closedTicketControlsRow,
  buildThreadComponents,
} = require("../components");
const {
  getLocale,
  createTicketId,
  deleteUserMessage,
  ensureThread,
  formatEta,
} = require("../utils");
const { EmbedBuilder } = require("discord.js");

function createTicketService(client, inMemory) {
  async function hasAvailableSupport(guild, config) {
    try {
      const members = await guild.members.fetch({ withPresences: true });
      const availableStatuses = new Set(["online"]);
      if (config.supportRoleIds.length) {
        return members.some(
          (member) =>
            config.supportRoleIds.some((roleId) => member.roles.cache.has(roleId)) &&
            availableStatuses.has(member.presence?.status)
        );
      }
      return members.some(
        (member) =>
          member.permissions.has("ManageGuild") &&
          availableStatuses.has(member.presence?.status)
      );
    } catch {
      return true;
    }
  }

  async function getOnlineSupportCount(guild, config) {
    try {
      const members = await guild.members.fetch({ withPresences: true });
      const availableStatuses = new Set(["online"]);
      if (config.supportRoleIds.length) {
        return members.filter(
          (member) =>
            config.supportRoleIds.some((roleId) => member.roles.cache.has(roleId)) &&
            availableStatuses.has(member.presence?.status)
        ).size;
      }
      return members.filter(
        (member) =>
          member.permissions.has("ManageGuild") &&
          availableStatuses.has(member.presence?.status)
      ).size;
    } catch {
      return null;
    }
  }

  async function closeTicket({ guildId, ticket, config, reason }) {
    const data = loadData();
    ensureGuild(data, guildId);
    const ticketData = data.tickets[guildId][ticket.userId];
    if (!ticketData) return;
    if (ticket.closedByTag) {
      ticketData.closedByTag = ticket.closedByTag;
      ticketData.closedById = ticket.closedById;
    }
    ticketData.status = "closed";
    ticketData.closedAt = Date.now();
    ticketData.closeReason = reason;

    if (ticketData.closedById && reason !== "user close") {
      if (!data.guilds[guildId].supportStats) {
        data.guilds[guildId].supportStats = {};
      }
      const stats = data.guilds[guildId].supportStats[ticketData.closedById] || {
        closed: 0,
        claimed: 0,
      };
      stats.closed += 1;
      data.guilds[guildId].supportStats[ticketData.closedById] = stats;
    }
    saveData(data);

    if (ticket.threadId) {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(config.supportChannelId);
      const thread = await channel.threads.fetch(ticket.threadId).catch(() => null);
      if (thread) {
        if (ticket.threadMessageId) {
          const starter = await thread.messages.fetch(ticket.threadMessageId).catch(() => null);
          if (starter) {
            const locale = getLocale(ticket.language || config.language);
            const embed = buildTicketEmbed(ticketData, await client.users.fetch(ticket.userId), config, locale);
            await starter.edit({ embeds: [embed], components: buildThreadComponents(ticketData) }).catch(() => null);
          }
        }
        const locale = getLocale(ticket.language || config.language);
        await thread
          .send({
            embeds: [buildClosedControlsEmbed(locale, ticketData, config)],
            components: [closedTicketControlsRow],
          })
          .catch(() => null);
        await thread.setLocked(true).catch(() => null);
        await thread.setArchived(true).catch(() => null);
      }
    }

    const user = await client.users.fetch(ticket.userId).catch(() => null);
    if (user) {
      const locale = getLocale(ticket.language || config.language);
      await deleteUserMessage(user, ticketData.awaitingMessageId);
      await deleteUserMessage(user, ticketData.dmCloseMessageId);
      ticketData.awaitingMessageId = null;
      ticketData.dmCloseMessageId = null;
      saveData(data);
      if (reason === "idle timeout") {
        await user.send(messages[locale].idleClosed).catch(() => null);
      }
      const closedMessage = await user
        .send({ embeds: [buildClosedEmbed(locale, ticketData, config)], components: [ratingRow] })
        .catch(() => null);
      if (closedMessage) {
        inMemory.pending.set(user.id, {
          step: "rating",
          guildId,
          ticketId: ticket.id,
          language: locale,
        });
      }
    }
  }

  async function createTicketFromPending(user, pending) {
    const data = loadData();
    ensureGuild(data, pending.guildId);
    const config = getGuildConfig(pending.guildId);
    const locale = getLocale(pending.language || config.language);

    const existing = data.tickets[pending.guildId][user.id];
    if (existing && existing.status === "open") {
      await user.send(messages[locale].alreadyOpen).catch(() => null);
      return;
    }

    if (!config.supportChannelId) {
      await user.send(messages[locale].setupRequired).catch(() => null);
      return;
    }

    const ticketId = createTicketId();
    const ticketNumber = data.nextTicketNumber || 1;
    data.nextTicketNumber = ticketNumber + 1;
    const ticket = {
      id: ticketId,
      number: ticketNumber,
      guildId: pending.guildId,
      userId: user.id,
      userTag: user.tag,
      openedAt: Date.now(),
      claimedAt: null,
      firstResponseAt: null,
      status: "open",
      language: locale,
      category: pending.category || "general",
      reason: pending.reason,
      messages: [],
      lastActivity: Date.now(),
      lastUserActivity: Date.now(),
    };

    data.tickets[pending.guildId][user.id] = ticket;
    saveData(data);

    const guild = await client.guilds.fetch(pending.guildId);
    const channel = await guild.channels.fetch(config.supportChannelId);
    const thread = await ensureThread(channel, `ticket-${ticketNumber}`);
    ticket.threadId = thread.id;
    saveData(data);

    const embed = buildTicketEmbed(ticket, user, config, locale);
    if (config.mentionRoleId) {
      const ping = await thread.send({ content: `<@&${config.mentionRoleId}>` }).catch(() => null);
      if (ping) {
        setTimeout(() => ping.delete().catch(() => null), 3000);
      }
    }
    const starterMessage = await thread.send({
      content: `<@${user.id}>`,
      embeds: [embed],
      components: buildThreadComponents(ticket),
    });
    ticket.threadMessageId = starterMessage.id;
    saveData(data);


    if (config.waitingThreshold) {
      const openTickets = Object.values(data.tickets[pending.guildId]).filter(
        (entry) => entry.status === "open"
      ).length;
      if (openTickets >= config.waitingThreshold) {
        await user.send(messages[locale].waiting).catch(() => null);
      }
    }

    const openTickets = Object.values(data.tickets[pending.guildId]).filter(
      (entry) => entry.status === "open"
    ).length;
    const etaMinutes = Math.max(5, openTickets * 5);
    const supportAvailable = await hasAvailableSupport(guild, config);
    const supportCount = await getOnlineSupportCount(guild, config);
    const dmCloseMessage = await user
      .send({ content: messages[locale].ticketOpened, components: [dmCloseRow] })
      .catch(() => null);
    if (!dmCloseMessage) {
      await closeTicket({ guildId: pending.guildId, ticket, config, reason: "dm failed" });
      return;
    }
    ticket.dmCloseMessageId = dmCloseMessage.id;
    saveData(data);
    const awaitingMessage = await user
      .send({ embeds: [buildAwaitingEmbed(locale, etaMinutes, config)] })
      .catch(() => null);
    if (!awaitingMessage) {
      await closeTicket({ guildId: pending.guildId, ticket, config, reason: "dm failed" });
      return;
    }
    ticket.awaitingMessageId = awaitingMessage.id;
    saveData(data);
    if (supportCount === 0 || !supportAvailable) {
      const etaText = messages[locale].noSupportAvailableEta.replace("{eta}", formatEta(etaMinutes));
      await user.send(`${messages[locale].noSupportAvailable}\n${etaText}`).catch(() => null);
    } else if (supportCount === 1) {
      await user.send(messages[locale].supportAvailableOne).catch(() => null);
    } else if (supportCount >= 2) {
      await user.send(messages[locale].supportAvailableMany).catch(() => null);
    }
  }

  async function forwardUserMessage(message, ticket, config) {
    const data = loadData();
    ensureGuild(data, ticket.guildId);
    const guild = await client.guilds.fetch(ticket.guildId);
    const channel = await guild.channels.fetch(config.supportChannelId);
    const thread = await channel.threads.fetch(ticket.threadId).catch(() => null);
    if (!thread) return;

    const embed = new EmbedBuilder()
      .setDescription(message.content)
      .setAuthor({ name: `${message.author.tag} (${message.author.id})` })
      .setTimestamp();

    await thread.send({ content: `<@${message.author.id}>`, embeds: [embed] });

    const stored = data.tickets[ticket.guildId][ticket.userId];
    if (stored) {
      stored.messages.push({
        from: "user",
        content: message.content,
        timestamp: Date.now(),
        authorTag: message.author.tag,
        authorId: message.author.id,
        authorAvatar: message.author.displayAvatarURL({ extension: "png", size: 64 }),
      });
      stored.lastActivity = Date.now();
      stored.lastUserActivity = Date.now();
      saveData(data);
    }
  }

  async function closeIdleTickets() {
    const data = loadData();
    const now = Date.now();
    for (const [guildId, tickets] of Object.entries(data.tickets)) {
      const config = getGuildConfig(guildId);
      for (const ticket of Object.values(tickets)) {
        if (ticket.status !== "open") continue;
        if (!ticket.lastUserActivity) continue;
        const idleLimit = config.idleCloseMinutes * 60_000;
        if (now - ticket.lastUserActivity > idleLimit) {
          await closeTicket({
            guildId,
            ticket,
            config,
            reason: "idle timeout",
          });
        }
      }
    }
  }

  return { closeTicket, createTicketFromPending, forwardUserMessage, closeIdleTickets };
}

module.exports = { createTicketService };

