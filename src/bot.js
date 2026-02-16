const { Client, GatewayIntentBits, Partials } = require("discord.js");
const System = require("../System/System");
const { registerSlashCommands } = require("./commands/register");
const { registerMessageCreate } = require("./events/messageCreate");
const { registerInteractionCreate } = require("./events/interactionCreate");
const { registerGuildEvents } = require("./events/guildEvents");
const { startCleanupIntervals } = require("./events/cleanup");
const { createTicketService } = require("./services/tickets");
const inMemory = require("./state/inMemory");
const { loadData, ensureGuild, getGuildConfig, getPrimaryGuildId } = require("./data/store");
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } = require("@discordjs/voice");

function applyPresence(client, config) {
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

async function joinConfiguredVoice(guild) {
  const config = getGuildConfig(guild.id);
  if (!config.voiceChannelId) return;
  const channel = await guild.channels.fetch(config.voiceChannelId).catch(() => null);
  if (!channel || !channel.isVoiceBased()) return;
  const existing = getVoiceConnection(guild.id);
  if (existing && existing.joinConfig.channelId === channel.id) return;
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 10_000).catch(() => null);
}

function startBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  registerMessageCreate(client);
  registerInteractionCreate(client);
  registerGuildEvents(client);

  const ticketService = createTicketService(client, inMemory);
  startCleanupIntervals(ticketService.closeIdleTickets);

  client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log("حقوق المطور:");
    console.log("Discord: moundo1");
    console.log("Server Discord: https://discord.gg/AsgyCjWf2r");
    console.log("GitHub: https://github.com/MrMoundo");
    console.log("YouTube: https://www.youtube.com/@Mr-Moundo");
    registerSlashCommands(client).catch((error) => console.error(error));
    const data = loadData();
    for (const guild of client.guilds.cache.values()) {
      ensureGuild(data, guild.id);
      joinConfiguredVoice(guild).catch(() => null);
    }
    const primaryGuildId = getPrimaryGuildId(client);
    if (primaryGuildId) {
      applyPresence(client, getGuildConfig(primaryGuildId));
    } else {
      applyPresence(client, {});
    }
  });

  client.on("voiceStateUpdate", (oldState, newState) => {
    if (!client.user || newState.id !== client.user.id) return;
    const guild = newState.guild;
    const config = getGuildConfig(guild.id);
    if (!config.voiceChannelId) return;
    const targetId = config.voiceChannelId;
    if (newState.channelId !== targetId) {
      setTimeout(() => {
        joinConfiguredVoice(guild).catch(() => null);
      }, 2000);
    }
  });

  if (!System.token) {
    console.error("Missing DISCORD_TOKEN env var.");
    process.exit(1);
  }

  client.login(System.token);
  return client;
}

module.exports = { startBot };
