const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const messages = require("../messages");
const inMemory = require("../state/inMemory");
const {
  loadData,
  saveData,
  ensureGuild,
  getGuildConfig,
  getPrimaryGuildId,
  pruneExpiredBlacklist,
} = require("../data/store");
const { getLocale, isManager, isSupport, deleteUserMessage, formatDurationMs } = require("../utils");
const { closeConfirmRow, deleteConfirmRow, closedTicketControlsRow, buildThreadComponents } = require("../components");
const {
  buildFeedbackEmbed,
  buildTicketEmbed,
  buildTicketLogEmbed,
  buildRatingLogEmbed,
  buildTranscriptEmbed,
} = require("../embeds");
const { createTicketService } = require("../services/tickets");
const { createPendingService } = require("../services/pending");

async function replyEphemeral(interaction, content, components) {
  const payload = {
    content,
    flags: 64,
    components: components ? [components].flat() : undefined,
  };
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload).catch(() => null);
  }
  return interaction.reply(payload).catch(() => null);
}

async function safeDeferUpdate(interaction) {
  if (interaction.deferred || interaction.replied) return;
  await interaction.deferUpdate().catch(() => null);
}

async function editInteractionMessage(interaction, payload) {
  if (!interaction?.message) return null;
  return interaction.message.edit(payload).catch(() => null);
}

function applyBotPresence(client, config) {
  if (!client.user) return;
  const statusMap = {
    online: "online",
    dnd: "dnd",
    sleep: "idle",
    offline: "invisible",
  };
  const selected = String(config?.botStatus || "online").toLowerCase();
  const status = statusMap[selected] || "online";
  const activityName = config?.botActivity || "DM For Help";
  client.user.setPresence({
    activities: status === "invisible" ? [] : [{ name: activityName, type: 0 }],
    status,
  });
}

function buildTranscriptHtml(ticket, config, guild) {
  const createdAt = ticket.openedAt ? new Date(ticket.openedAt).toLocaleString() : "-";
  const closedAt = ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : "-";
  const htmlBody = (ticket.messages || [])
    .map((entry) => {
      const time = new Date(entry.timestamp).toLocaleString();
      const supportName = config.supportLabel || "Chillaxy Support";
      const author =
        entry.from === "staff"
          ? (entry.authorTag || supportName)
          : (entry.authorTag || ticket.userTag);
      const authorId =
        entry.from === "staff"
          ? (entry.authorId && entry.authorId !== "support" ? entry.authorId : "Support")
          : (entry.authorId || ticket.userId);
      const avatarUrl =
        entry.authorAvatar ||
        (entry.from === "staff"
          ? (guild?.iconURL({ extension: "png", size: 64 }) || "")
          : "");
      const roleClass = entry.from === "staff" ? "msg staff" : "msg user";
      const safe = String(entry.content)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<div class="${roleClass}">
  <div class="avatar">
    ${avatarUrl ? `<img src="${avatarUrl}" alt="avatar">` : `<span>${author.slice(0, 2).toUpperCase()}</span>`}
  </div>
  <div class="content">
    <div class="meta">
      <span class="author">${author}</span>
      <span class="author-id">${authorId}</span>
      <span class="timestamp">${time}</span>
    </div>
    <div class="bubble">${safe}</div>
  </div>
</div>`;
    })
    .join("\n");
  const htmlMeta = `<div class="meta-grid">
  <div><span>Ticket ID</span><strong>#${ticket.number}</strong></div>
  <div><span>Opened By</span><strong>${ticket.userTag} (${ticket.userId})</strong></div>
  <div><span>Claimed By</span><strong>${ticket.claimedByTag || "-"}</strong></div>
  <div><span>Closed By</span><strong>${ticket.closedByTag || "-"}</strong></div>
  <div><span>Opened At</span><strong>${createdAt}</strong></div>
  <div><span>Closed At</span><strong>${closedAt}</strong></div>
</div>`;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Ticket ${ticket.id}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        font-family: "gg sans", "Segoe UI", Arial, sans-serif;
        background: #2b2d31;
        color: #f2f3f5;
      }
      .header {
        padding: 24px;
        background: #1e1f22;
        border-bottom: 1px solid #111214;
      }
      .header h1 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 700;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        font-size: 13px;
      }
      .meta-grid span {
        display: block;
        color: #b5bac1;
        margin-bottom: 4px;
      }
      .meta-grid strong { color: #f2f3f5; }
      .chat {
        padding: 16px 24px 32px 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .msg { display: flex; gap: 12px; }
      .avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #3b3f45;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #b5bac1;
        overflow: hidden;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .msg.staff .avatar { background: #3a4b7a; color: #dbe0ff; }
      .content { max-width: 900px; }
      .meta {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 4px;
      }
      .author { font-weight: 600; }
      .author-id {
        font-size: 12px;
        color: #b5bac1;
      }
      .timestamp { color: #949ba4; font-size: 12px; }
      .bubble {
        background: #313338;
        border: 1px solid #1f2023;
        border-radius: 10px;
        padding: 10px 12px;
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .msg.staff .bubble { background: #2f3b57; border-color: #242c40; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Ticket Transcript</h1>
      ${htmlMeta}
    </div>
    <div class="chat">
      ${htmlBody || "<div class=\"bubble\">No messages logged.</div>"}
    </div>
  </body>
</html>`;
}

async function sendTranscriptMessage({ ticket, config, locale, guild, channel, existingMessageId, savedBy }) {
  const html = buildTranscriptHtml(ticket, config, guild);
  const file = new AttachmentBuilder(Buffer.from(html), {
    name: `ticket-${ticket.id}.html`,
  });
  const embed = buildTranscriptEmbed(ticket, locale, config, savedBy);
  if (existingMessageId) {
    const message = await channel.messages.fetch(existingMessageId).catch(() => null);
    if (message) {
      await message.edit({ embeds: [embed] }).catch(() => null);
      return { message, updated: true };
    }
  }
  const sentMessage = await channel.send({ embeds: [embed], files: [file] }).catch(() => null);
  return sentMessage ? { message: sentMessage, updated: false } : null;
}

function registerInteractionCreate(client) {
  const ticketService = createTicketService(client, inMemory);
  const pendingService = createPendingService(inMemory, ticketService.createTicketFromPending);

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("ticket_close_reason:")) {
        const threadId = interaction.customId.split(":")[1];
        const reason = interaction.fields.getTextInputValue("close_reason");
        const data = loadData();
        const ticket = Object.values(data.tickets[interaction.guild.id] || {}).find(
          (entry) => entry.threadId === threadId
        );
        if (!ticket) {
          await replyEphemeral(interaction, "Ticket not found.");
          return;
        }
        const config = getGuildConfig(interaction.guild.id);
        if (!isSupport(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        ticket.closedByTag = interaction.user.tag;
        ticket.closedById = interaction.user.id;
        ticket.closeReason = reason;
        await interaction.update({ content: "Closing ticket...", components: [] }).catch(() => null);
        await ticketService.closeTicket({ guildId: interaction.guild.id, ticket, config, reason });
        return;
      }

      if (!interaction.customId.startsWith("ticket_feedback:")) return;
      const ticketId = interaction.customId.split(":")[1];
      const feedback = interaction.fields.getTextInputValue("feedback");
      const data = loadData();
      let found = null;
      let guildId = null;
      for (const [gid, tickets] of Object.entries(data.tickets)) {
        const t = Object.values(tickets).find((entry) => entry.id === ticketId);
        if (t) {
          found = t;
          guildId = gid;
          break;
        }
      }
      if (!found || !guildId) {
        await replyEphemeral(interaction, "Ticket not found.");
        return;
      }
      found.feedback = feedback;
      saveData(data);
      const config = getGuildConfig(guildId);
      const locale = getLocale(found.language || config.language);
      let updatedTranscript = false;
      if (found.logTranscriptMessageId) {
        if (config.logsChannelId) {
          const guild = await client.guilds.fetch(guildId).catch(() => null);
          const logsChannel = await guild?.channels.fetch(config.logsChannelId).catch(() => null);
          if (logsChannel) {
            const msg = await logsChannel.messages.fetch(found.logTranscriptMessageId).catch(() => null);
            if (msg) {
              const updatedTranscriptEmbed = buildTranscriptEmbed(found, locale, config);
              await msg.edit({ embeds: [updatedTranscriptEmbed] }).catch(() => null);
              updatedTranscript = true;
            }
            if (found.logTicketMessageId) {
              const logMsg = await logsChannel.messages.fetch(found.logTicketMessageId).catch(() => null);
              if (logMsg) {
                const updated = buildTicketLogEmbed(found, locale);
                await logMsg.edit({ embeds: [updated] }).catch(() => null);
              }
            }
          }
        } else if (found.threadId) {
          const guild = await client.guilds.fetch(guildId).catch(() => null);
          const channel = await guild?.channels.fetch(config.supportChannelId).catch(() => null);
          const thread = await channel?.threads.fetch(found.threadId).catch(() => null);
          if (thread) {
            const msg = await thread.messages.fetch(found.logTranscriptMessageId).catch(() => null);
            if (msg) {
              const updatedTranscriptEmbed = buildTranscriptEmbed(found, locale, config);
              await msg.edit({ embeds: [updatedTranscriptEmbed] }).catch(() => null);
              updatedTranscript = true;
            }
          }
        }
      }
      if (!updatedTranscript && config.logsChannelId) {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        const logsChannel = await guild?.channels.fetch(config.logsChannelId).catch(() => null);
        if (logsChannel) {
          const embed = buildFeedbackEmbed(found, found.rating, feedback);
          const sent = await logsChannel.send({ embeds: [embed] }).catch(() => null);
          if (sent) {
            found.logRatingMessageId = sent.id;
            saveData(data);
          }
          if (found.logTicketMessageId) {
            const msg = await logsChannel.messages.fetch(found.logTicketMessageId).catch(() => null);
            if (msg) {
              const updated = buildTicketLogEmbed(found, locale);
              await msg.edit({ embeds: [updated] }).catch(() => null);
            }
          }
        }
      }
      inMemory.pending.delete(interaction.user.id);
      await replyEphemeral(interaction, "Thanks.");
      return;
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const supportChannel = interaction.options.getChannel("support_channel");
        const logsChannel = interaction.options.getChannel("logs_channel");
        const supportRole = interaction.options.getRole("support_role");
        const mentionRole = interaction.options.getRole("mention_role");
        const language = interaction.options.getString("language");
        const embedColor = interaction.options.getString("embed_color");
        const bannerUrl = interaction.options.getString("banner_url");

        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        data.guilds[interaction.guild.id].config = {
          ...data.guilds[interaction.guild.id].config,
          supportChannelId: supportChannel.id,
          logsChannelId: logsChannel.id,
          supportRoleIds: [supportRole.id],
          mentionRoleId: mentionRole?.id || "",
          language,
          embedColor: embedColor || config.embedColor,
          bannerUrl: bannerUrl || config.bannerUrl,
        };
        // Always make the server where /setup runs the active DM ticket server.
        data.primaryGuildId = interaction.guild.id;
        data.guilds[interaction.guild.id].removedAt = null;
        saveData(data);

        await interaction.reply({ content: "Setup complete. This server is now the active ticket server.", flags: 64 });
        return;
      }

      if (interaction.commandName === "set-admin-role") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const role = interaction.options.getRole("role");
        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        data.guilds[interaction.guild.id].config = {
          ...data.guilds[interaction.guild.id].config,
          adminRoleId: role.id,
        };
        saveData(data);
        await replyEphemeral(interaction, `Admin role set to <@&${role.id}>.`);
        return;
      }

      if (interaction.commandName === "config") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "set") {
          const supportChannel = interaction.options.getChannel("support_channel");
          const logsChannel = interaction.options.getChannel("logs_channel");
          const supportRole = interaction.options.getRole("support_role");
          const mentionRole = interaction.options.getRole("mention_role");
          const adminRole = interaction.options.getRole("admin_role");
          const language = interaction.options.getString("language");
          const embedColor = interaction.options.getString("embed_color");
          const bannerUrl = interaction.options.getString("banner_url");

          const data = loadData();
          ensureGuild(data, interaction.guild.id);
          const existing = data.guilds[interaction.guild.id].config || {};
          data.guilds[interaction.guild.id].config = {
            ...existing,
            supportChannelId: supportChannel?.id || existing.supportChannelId,
            logsChannelId: logsChannel?.id || existing.logsChannelId,
            supportRoleIds: supportRole ? [supportRole.id] : (existing.supportRoleIds || config.supportRoleIds),
            mentionRoleId: mentionRole?.id || existing.mentionRoleId,
            adminRoleId: adminRole?.id || existing.adminRoleId,
            language: language || existing.language || config.language,
            embedColor: embedColor || existing.embedColor || config.embedColor,
            bannerUrl: bannerUrl || existing.bannerUrl || config.bannerUrl,
          };
          saveData(data);
          await replyEphemeral(interaction, "Configuration updated.");
          return;
        }
        if (subcommand === "show") {
          const fields = [
            `Support channel: ${config.supportChannelId ? `<#${config.supportChannelId}>` : "Not set"}`,
            `Logs channel: ${config.logsChannelId ? `<#${config.logsChannelId}>` : "Not set"}`,
            `Support role: ${config.supportRoleIds?.length ? config.supportRoleIds.map((id) => `<@&${id}>`).join(" ") : "Not set"}`,
            `Admin role: ${config.adminRoleId ? `<@&${config.adminRoleId}>` : "Not set"}`,
            `Owner user: ${config.ownerUserId ? `<@${config.ownerUserId}>` : "Not set"}`,
            `Mention role: ${config.mentionRoleId ? `<@&${config.mentionRoleId}>` : "Not set"}`,
            `Bot status: ${config.botStatus || "online"}`,
            `Language: ${config.language}`,
            `Embed color: ${config.embedColor}`,
            `Banner URL: ${config.bannerUrl || "Not set"}`,
          ];
          await replyEphemeral(interaction, fields.join("\n"));
          return;
        }
      }

      if (interaction.commandName === "blacklist") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const subcommand = interaction.options.getSubcommand();
        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        pruneExpiredBlacklist(data, interaction.guild.id);
        const list = data.blacklist[interaction.guild.id];
        if (subcommand === "add") {
          const user = interaction.options.getUser("user");
          const reason = interaction.options.getString("reason") || "";
          list.permanent[user.id] = {
            reason,
            by: interaction.user.id,
            at: Date.now(),
          };
          if (list.temporary[user.id]) delete list.temporary[user.id];
          saveData(data);
          await replyEphemeral(interaction, `Blacklisted <@${user.id}>.`);
          return;
        }
        if (subcommand === "remove") {
          const user = interaction.options.getUser("user");
          delete list.permanent[user.id];
          delete list.temporary[user.id];
          saveData(data);
          await replyEphemeral(interaction, `Removed <@${user.id}> from blacklist.`);
          return;
        }
        if (subcommand === "list") {
          const entries = Object.keys(list.permanent);
          if (!entries.length) {
            await replyEphemeral(interaction, "No users are blacklisted.");
            return;
          }
          const lines = entries.slice(0, 20).map((id) => `<@${id}>`);
          const more = entries.length > 20 ? `\n...and ${entries.length - 20} more` : "";
          await replyEphemeral(interaction, `Blacklisted users:\n${lines.join("\n")}${more}`);
          return;
        }
      }

      if (interaction.commandName === "tempblacklist") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const subcommand = interaction.options.getSubcommand();
        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        pruneExpiredBlacklist(data, interaction.guild.id);
        const list = data.blacklist[interaction.guild.id];
        if (subcommand === "add") {
          const user = interaction.options.getUser("user");
          const durationMinutes = interaction.options.getInteger("duration_minutes");
          const reason = interaction.options.getString("reason") || "";
          const expiresAt = Date.now() + Math.max(1, durationMinutes) * 60_000;
          list.temporary[user.id] = {
            reason,
            by: interaction.user.id,
            at: Date.now(),
            expiresAt,
          };
          if (list.permanent[user.id]) delete list.permanent[user.id];
          saveData(data);
          await replyEphemeral(interaction, `Temporarily blacklisted <@${user.id}> for ${durationMinutes} minutes.`);
          return;
        }
        if (subcommand === "remove") {
          const user = interaction.options.getUser("user");
          delete list.temporary[user.id];
          saveData(data);
          await replyEphemeral(interaction, `Removed <@${user.id}> from temporary blacklist.`);
          return;
        }
        if (subcommand === "list") {
          const entries = Object.entries(list.temporary);
          if (!entries.length) {
            await replyEphemeral(interaction, "No users are temporarily blacklisted.");
            return;
          }
          const lines = entries.slice(0, 20).map(([id, entry]) => {
            const remaining = entry.expiresAt ? formatDurationMs(entry.expiresAt - Date.now()) : "unknown";
            return `<@${id}> (${remaining})`;
          });
          const more = entries.length > 20 ? `\n...and ${entries.length - 20} more` : "";
          await replyEphemeral(interaction, `Temp blacklisted users:\n${lines.join("\n")}${more}`);
          return;
        }
      }

      if (interaction.commandName === "toprank") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        const stats = data.guilds[interaction.guild.id].supportStats || {};
        const entries = Object.entries(stats)
          .map(([id, entry]) => ({
            id,
            closed: entry.closed || 0,
            claimed: entry.claimed || 0,
          }))
          .sort((a, b) => {
            if (b.closed !== a.closed) return b.closed - a.closed;
            return b.claimed - a.claimed;
          })
          .slice(0, 10);
        if (!entries.length) {
          await replyEphemeral(interaction, "No support stats available yet.");
          return;
        }
        const lines = entries.map(
          (entry, index) =>
            `${index + 1}. <@${entry.id}> — Closed: ${entry.closed}, Claimed: ${entry.claimed}`
        );
        await replyEphemeral(interaction, `Top Support Members:\n${lines.join("\n")}`);
        return;
      }

      if (interaction.commandName === "purge-user") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const target = interaction.options.getUser("user");
        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        delete data.tickets[interaction.guild.id][target.id];
        saveData(data);
        await replyEphemeral(interaction, "User data deleted.");
      }
      if (interaction.commandName === "close-all") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        if (!config.logsChannelId) {
          await replyEphemeral(interaction, "Logs channel is not set.");
          return;
        }
        await interaction.deferReply({ flags: 64 }).catch(() => null);
        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        const openTickets = Object.values(data.tickets[interaction.guild.id] || {}).filter(
          (entry) => entry.status === "open"
        );
        if (!openTickets.length) {
          await interaction.editReply({ content: "No open tickets found." }).catch(() => null);
          return;
        }
        const guild = await client.guilds.fetch(interaction.guild.id).catch(() => null);
        const logsChannel = await guild?.channels.fetch(config.logsChannelId).catch(() => null);
        if (!logsChannel) {
          await interaction.editReply({ content: "Logs channel not accessible." }).catch(() => null);
          return;
        }
        await logsChannel
          .send({
            embeds: [
              new EmbedBuilder()
                .setTitle("Bulk Ticket Close")
                .setColor(config.embedColor || "#5865F2")
                .setDescription("All open tickets were closed and logged.")
                .addFields(
                  { name: "Reason", value: "Bulk close all tickets" },
                  { name: "Executed By", value: `${interaction.user.tag} (${interaction.user.id})` },
                  { name: "Total Open Tickets", value: String(openTickets.length) }
                )
                .setTimestamp()
            ],
          })
          .catch(() => null);
        let closedCount = 0;
        let loggedCount = 0;
        let deletedCount = 0;
        for (const ticket of openTickets) {
          ticket.closedByTag = interaction.user.tag;
          ticket.closedById = interaction.user.id;
          ticket.closeReason = "bulk close";
          ticket.status = "closed";
          ticket.closedAt = Date.now();
          await ticketService
            .closeTicket({ guildId: interaction.guild.id, ticket, config, reason: "bulk close" })
            .catch(() => null);
          closedCount += 1;

          const locale = getLocale(ticket.language || config.language);
          const logResult = await sendTranscriptMessage({
            ticket,
            config,
            locale,
            guild,
            channel: logsChannel,
          }).catch(() => null);
          if (logResult?.message) {
            const latest = loadData();
            ensureGuild(latest, interaction.guild.id);
            const stored = latest.tickets[interaction.guild.id]?.[ticket.userId];
            if (stored) {
              stored.logTranscriptMessageId = logResult.message.id;
              saveData(latest);
            }
            loggedCount += 1;
          }

          if (ticket.threadId) {
            const supportChannel = await guild?.channels.fetch(config.supportChannelId).catch(() => null);
            const thread = await supportChannel?.threads.fetch(ticket.threadId).catch(() => null);
            if (thread) {
              await thread.delete("Bulk close").catch(() => null);
              deletedCount += 1;
            }
          }
        }
        await interaction
          .editReply({
            content: `Closed ${closedCount} tickets. Logged ${loggedCount}. Deleted ${deletedCount} threads.`,
          })
          .catch(() => null);
      }
      if (interaction.commandName === "voice") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const subcommand = interaction.options.getSubcommand();
        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        if (subcommand === "set") {
          const channel = interaction.options.getChannel("channel");
          data.guilds[interaction.guild.id].config = {
            ...(data.guilds[interaction.guild.id].config || {}),
            voiceChannelId: channel.id,
          };
          saveData(data);
          joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true,
          });
          await replyEphemeral(interaction, `Voice channel set to <#${channel.id}>.`);
          return;
        }
        if (subcommand === "clear") {
          data.guilds[interaction.guild.id].config = {
            ...(data.guilds[interaction.guild.id].config || {}),
            voiceChannelId: "",
          };
          saveData(data);
          const existing = getVoiceConnection(interaction.guild.id);
          if (existing) {
            existing.destroy();
          }
          await replyEphemeral(interaction, "Voice channel cleared.");
          return;
        }
      }
      if (interaction.commandName === "bot-status") {
        const config = getGuildConfig(interaction.guild.id);
        if (!isManager(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        const requested = interaction.options.getString("status", true);
        const data = loadData();
        ensureGuild(data, interaction.guild.id);
        data.guilds[interaction.guild.id].config = {
          ...(data.guilds[interaction.guild.id].config || {}),
          botStatus: requested,
        };
        saveData(data);
        const updatedConfig = getGuildConfig(interaction.guild.id);
        applyBotPresence(client, updatedConfig);
        await replyEphemeral(interaction, `Bot status updated to \`${requested}\`.`);
        return;
      }
      return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith("ticket_lang:")) {
      const lang = interaction.customId.split(":")[1];
      const pending = inMemory.pending.get(interaction.user.id);
      if (!pending || pending.step !== "language") {
        await replyEphemeral(interaction, messages.ar.invalidChoice);
        return;
      }
      pending.language = lang;
      pending.step = "reason";
      await replyEphemeral(interaction, "Updated.");
      await pendingService.sendPendingPrompt(interaction.user, pending);
      return;
    }

    if (interaction.customId.startsWith("ticket_rate:")) {
      const rating = Number(interaction.customId.split(":")[1]);
      const pending = inMemory.pending.get(interaction.user.id);
      if (!pending || pending.step !== "rating") {
        await replyEphemeral(interaction, "Not active.");
        return;
      }
      const data = loadData();
      ensureGuild(data, pending.guildId);
      const ticket = Object.values(data.tickets[pending.guildId]).find(
        (entry) => entry.id === pending.ticketId
      );
      if (ticket) {
        ticket.rating = rating;
        saveData(data);
      }
      if (rating < 3) {
        pending.step = "rating_feedback";
        const modal = new ModalBuilder()
          .setCustomId(`ticket_feedback:${pending.ticketId}`)
          .setTitle("Support Feedback")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("feedback")
                .setLabel("What went wrong? How can we improve?")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000)
            )
          );
        await interaction.showModal(modal).catch(() => null);
        return;
      }
      const config = getGuildConfig(pending.guildId);
      const locale = getLocale(ticket?.language || config.language);
      let updatedTranscript = false;
      if (ticket?.logTranscriptMessageId) {
        if (config.logsChannelId) {
          const guild = await client.guilds.fetch(pending.guildId).catch(() => null);
          const logsChannel = await guild?.channels.fetch(config.logsChannelId).catch(() => null);
          if (logsChannel) {
            const msg = await logsChannel.messages.fetch(ticket.logTranscriptMessageId).catch(() => null);
            if (msg) {
              const updatedTranscriptEmbed = buildTranscriptEmbed(ticket, locale, config);
              await msg.edit({ embeds: [updatedTranscriptEmbed] }).catch(() => null);
              updatedTranscript = true;
            }
            if (ticket.logTicketMessageId) {
              const logMsg = await logsChannel.messages.fetch(ticket.logTicketMessageId).catch(() => null);
              if (logMsg) {
                const updated = buildTicketLogEmbed(ticket, locale);
                await logMsg.edit({ embeds: [updated] }).catch(() => null);
              }
            }
          }
        } else if (ticket.threadId) {
          const guild = await client.guilds.fetch(pending.guildId).catch(() => null);
          const channel = await guild?.channels.fetch(config.supportChannelId).catch(() => null);
          const thread = await channel?.threads.fetch(ticket.threadId).catch(() => null);
          if (thread) {
            const msg = await thread.messages.fetch(ticket.logTranscriptMessageId).catch(() => null);
            if (msg) {
              const updatedTranscriptEmbed = buildTranscriptEmbed(ticket, locale, config);
              await msg.edit({ embeds: [updatedTranscriptEmbed] }).catch(() => null);
              updatedTranscript = true;
            }
          }
        }
      }
      if (!updatedTranscript && config.logsChannelId) {
        const guild = await client.guilds.fetch(pending.guildId).catch(() => null);
        const logsChannel = await guild?.channels.fetch(config.logsChannelId).catch(() => null);
        if (logsChannel && ticket) {
          const embed = buildRatingLogEmbed(ticket, rating, ticket.feedback, locale);
          const sent = await logsChannel.send({ embeds: [embed] }).catch(() => null);
          if (sent) {
            ticket.logRatingMessageId = sent.id;
            saveData(data);
          }
          if (ticket.logTicketMessageId) {
            const msg = await logsChannel.messages.fetch(ticket.logTicketMessageId).catch(() => null);
            if (msg) {
              const updated = buildTicketLogEmbed(ticket, locale);
              await msg.edit({ embeds: [updated] }).catch(() => null);
            }
          }
        }
      }
      inMemory.pending.delete(interaction.user.id);
      await interaction.update({ content: "Thanks.", components: [] }).catch(() => null);
      return;
    }

    if (interaction.customId === "ticket_close_request") {
      await interaction
        .update({ content: "Are you sure you want to close?", components: [closeConfirmRow] })
        .catch(() => null);
      return;
    }

    if (interaction.customId === "ticket_close_confirm") {
      const data = loadData();
      if (interaction.channel?.isThread()) {
        const guildId = interaction.guild.id;
        const config = getGuildConfig(guildId);
        const ticket = Object.values(data.tickets[guildId]).find(
          (entry) => entry.threadId === interaction.channel.id
        );
        if (!ticket) {
          await replyEphemeral(interaction, "Ticket not found.");
          return;
        }
        if (!isSupport(interaction.member, config)) {
          await replyEphemeral(interaction, "Not allowed.");
          return;
        }
        ticket.closedByTag = interaction.user.tag;
        ticket.closedById = interaction.user.id;
        ticket.closeReason = "staff close";
        await interaction.update({ content: "Closing ticket...", components: [] }).catch(() => null);
        await ticketService.closeTicket({ guildId, ticket, config, reason: "staff close" });
        return;
      }
      const guildId = getPrimaryGuildId(client);
      if (!guildId) return;
      const ticket = data.tickets[guildId]?.[interaction.user.id];
      if (ticket?.status === "open") {
        const config = getGuildConfig(guildId);
        ticket.closedByTag = interaction.user.tag;
        ticket.closedById = interaction.user.id;
        ticket.closeReason = "user close";
        await interaction.update({ content: "Closing ticket...", components: [] }).catch(() => null);
        await ticketService.closeTicket({ guildId, ticket, config, reason: "user close" });
        return;
      }
    }

    if (interaction.customId === "ticket_close_cancel") {
      const data = loadData();
      if (interaction.channel?.isThread()) {
        const ticket = Object.values(data.tickets[interaction.guild.id] || {}).find(
          (entry) => entry.threadId === interaction.channel.id
        );
        if (ticket) {
          await interaction
            .update({ content: "Close cancelled.", components: buildThreadComponents(ticket) })
            .catch(() => null);
          return;
        }
      }
      await interaction.update({ content: "Close cancelled.", components: [] }).catch(() => null);
      return;
    }

    if (interaction.customId === "ticket_claim") {
      await safeDeferUpdate(interaction);
      const data = loadData();
      const config = getGuildConfig(interaction.guild.id);
      if (!isSupport(interaction.member, config)) {
        await interaction.followUp({ content: "Not allowed.", flags: 64 }).catch(() => null);
        return;
      }
      const ticket = Object.values(data.tickets[interaction.guild.id]).find(
        (entry) => entry.threadId === interaction.channel.id
      );
      if (!ticket) {
        await interaction.followUp({ content: "Ticket not found.", flags: 64 }).catch(() => null);
        return;
      }
      ticket.claimedBy = interaction.user.id;
      ticket.claimedByTag = interaction.user.tag;
      ticket.claimedAt = Date.now();
      if (!data.guilds[interaction.guild.id].supportStats) {
        data.guilds[interaction.guild.id].supportStats = {};
      }
      const stats = data.guilds[interaction.guild.id].supportStats[interaction.user.id] || {
        closed: 0,
        claimed: 0,
      };
      stats.claimed += 1;
      data.guilds[interaction.guild.id].supportStats[interaction.user.id] = stats;
      saveData(data);
      if (ticket.threadMessageId) {
        const thread = await interaction.channel.fetch().catch(() => null);
        if (thread) {
          const starter = await thread.messages.fetch(ticket.threadMessageId).catch(() => null);
          if (starter) {
            const locale = getLocale(ticket.language || config.language);
            const embed = buildTicketEmbed(
              ticket,
              await client.users.fetch(ticket.userId),
              config,
              locale
            );
            await starter.edit({ embeds: [embed], components: buildThreadComponents(ticket) }).catch(() => null);
          }
        }
      }
      const user = await client.users.fetch(ticket.userId).catch(() => null);
      if (user) {
        const locale = getLocale(ticket.language || config.language);
        const claimText = interaction.member.roles.cache.has(config.adminRoleId)
          ? messages[locale].claimNoticeAdmin
          : messages[locale].claimNoticeSupport;
        await deleteUserMessage(user, ticket.awaitingMessageId);
        ticket.awaitingMessageId = null;
        saveData(data);
        const sent = await user.send(claimText).catch(() => null);
        if (!sent) {
          await ticketService.closeTicket({ guildId: interaction.guild.id, ticket, config, reason: "dm failed" });
        }
      }
      await interaction.channel
        ?.send({ content: `Claimed by <@${interaction.user.id}>` })
        .catch(() => null);
      await interaction.followUp({ content: "Claimed.", flags: 64 }).catch(() => null);
      return;
    }


    if (interaction.customId === "ticket_delete_request") {
      const config = getGuildConfig(interaction.guild.id);
      if (!isManager(interaction.member, config)) {
        await replyEphemeral(interaction, "Not allowed.");
        return;
      }
      await safeDeferUpdate(interaction);
      const updated = await editInteractionMessage(interaction, {
        content: "This ticket will be deleted in 10 seconds. Confirm?",
        components: [deleteConfirmRow],
      });
      if (!updated) {
        await replyEphemeral(interaction, "Delete confirmation sent.");
      }
      return;
    }

    if (interaction.customId === "ticket_delete_confirm") {
      const config = getGuildConfig(interaction.guild.id);
      if (!isManager(interaction.member, config)) {
        await replyEphemeral(interaction, "Not allowed.");
        return;
      }
      await safeDeferUpdate(interaction);
      await interaction.followUp({ content: "Deleting ticket in 10 seconds.", flags: 64 }).catch(() => null);
      await interaction.channel
        ?.send({ content: "Ticket will be deleted in 10 seconds." })
        .catch(() => null);
      setTimeout(async () => {
        await interaction.channel?.delete("Ticket deleted").catch(() => null);
      }, 10_000);
      return;
    }

    if (interaction.customId === "ticket_delete_cancel") {
      const config = getGuildConfig(interaction.guild.id);
      if (!isManager(interaction.member, config)) {
        await replyEphemeral(interaction, "Not allowed.");
        return;
      }
      await safeDeferUpdate(interaction);
      const updated = await editInteractionMessage(interaction, {
        content: "Delete cancelled.",
        components: [closedTicketControlsRow],
      });
      if (!updated) {
        await replyEphemeral(interaction, "Delete cancelled.");
      }
      return;
    }

    if (interaction.customId === "ticket_close_reason") {
      const config = getGuildConfig(interaction.guild.id);
      if (!isSupport(interaction.member, config)) {
        await replyEphemeral(interaction, "Not allowed.");
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`ticket_close_reason:${interaction.channel.id}`)
        .setTitle("Close Ticket (Reason)")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("close_reason")
              .setLabel("Reason for closing")
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1000)
          )
        );
      await interaction.showModal(modal).catch(() => null);
      return;
    }

    if (interaction.customId === "ticket_transcript") {
      await safeDeferUpdate(interaction);
      const data = loadData();
      const ticket = Object.values(data.tickets[interaction.guild.id]).find(
        (entry) => entry.threadId === interaction.channel.id
      );
      if (!ticket) {
        await interaction.followUp({ content: "Ticket not found.", flags: 64 }).catch(() => null);
        return;
      }
      const config = getGuildConfig(interaction.guild.id);
      if (!isSupport(interaction.member, config)) {
        await interaction.followUp({ content: "Not allowed.", flags: 64 }).catch(() => null);
        return;
      }
      const locale = getLocale(ticket.language || config.language);
      ticket.logTranscriptSavedByTag = interaction.user.tag;
      ticket.logTranscriptSavedById = interaction.user.id;
      saveData(data);
      let sent = false;
      if (config.logsChannelId) {
        const logsChannel = await interaction.guild.channels
          .fetch(config.logsChannelId)
          .catch(() => null);
        if (logsChannel) {
          const result = await sendTranscriptMessage({
            ticket,
            config,
            locale,
            guild: interaction.guild,
            channel: logsChannel,
            existingMessageId: ticket.logTranscriptMessageId,
            savedBy: interaction.user,
          });
          if (result?.message && !result.updated) {
            ticket.logTranscriptMessageId = result.message.id;
            saveData(data);
          }
          sent = true;
        }
      }
      if (!sent) {
        const result = await sendTranscriptMessage({
          ticket,
          config,
          locale,
          guild: interaction.guild,
          channel: interaction.channel,
          savedBy: interaction.user,
        });
        if (result?.message) {
          ticket.logTranscriptMessageId = result.message.id;
          saveData(data);
        }
      }
      await interaction.followUp({ content: "Transcript saved.", flags: 64 }).catch(() => null);
      return;
    }



    if (interaction.customId !== "ticket_close") return;

    const data = loadData();
    ensureGuild(data, interaction.guild.id);
    const config = getGuildConfig(interaction.guild.id);
    const ticket = Object.values(data.tickets[interaction.guild.id]).find(
      (entry) => entry.threadId === interaction.channel.id
    );
    if (!ticket) {
      await replyEphemeral(interaction, "Ticket not found.");
      return;
    }
    if (!isSupport(interaction.member, config)) {
      await replyEphemeral(interaction, "Not allowed.");
      return;
    }
    await interaction
      .update({ content: "Are you sure you want to close this ticket?", components: [closeConfirmRow] })
      .catch(() => null);
  });
}

module.exports = { registerInteractionCreate };
