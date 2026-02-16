const { loadData, saveData, ensureGuild, getGuildConfig } = require("../data/store");
const System = require("../../System/System");
const inMemory = require("../state/inMemory");
const { createTicketService } = require("../services/tickets");

function registerGuildEvents(client) {
  const ticketService = createTicketService(client, inMemory);
  client.on("guildCreate", async (guild) => {
    const data = loadData();
    ensureGuild(data, guild.id);
    const meta = data.guilds[guild.id];
    if (meta?.removedAt) {
      const cutoff = System.defaults.removeDataAfterDays * 86_400_000;
      if (Date.now() - meta.removedAt > cutoff) {
        data.tickets[guild.id] = {};
      }
      meta.removedAt = null;
    }
    saveData(data);
  });

  client.on("guildDelete", async (guild) => {
    const data = loadData();
    ensureGuild(data, guild.id);
    data.guilds[guild.id].removedAt = Date.now();
    saveData(data);
  });

  client.on("guildMemberRemove", async (member) => {
    const data = loadData();
    const ticket = data.tickets?.[member.guild.id]?.[member.id];
    if (!ticket || ticket.status !== "open") return;
    const config = getGuildConfig(member.guild.id);
    await ticketService.closeTicket({
      guildId: member.guild.id,
      ticket,
      config,
      reason: "user left",
    });
  });
}

module.exports = { registerGuildEvents };
