const messages = require("../messages");
const { buildWelcomeEmbed } = require("../embeds");
const { buildLanguageButtons } = require("../components");
const { getLocale } = require("../utils");
const { ensureGuild, saveData, getGuildConfig } = require("../data/store");

function createPendingService(inMemory, createTicketFromPending) {
  async function handlePendingFlow(message, data) {
    const pending = inMemory.pending.get(message.author.id);
    if (!pending) return false;
    const locale = getLocale(pending.language || "ar");
    if (pending.expiresAt && Date.now() > pending.expiresAt) {
      inMemory.pending.delete(message.author.id);
      await message.author.send(messages[locale].setupExpired).catch(() => null);
      return true;
    }

    if (pending.step === "rating") {
      const rating = Number(message.content.trim());
      if (!rating || rating < 1 || rating > 5) {
        await message.author.send(messages[locale].invalidChoice).catch(() => null);
        return true;
      }
      ensureGuild(data, pending.guildId);
      const ticket = Object.values(data.tickets[pending.guildId]).find(
        (entry) => entry.id === pending.ticketId
      );
      if (ticket) {
        ticket.rating = rating;
        saveData(data);
      }
      inMemory.pending.delete(message.author.id);
      return true;
    }

    if (pending.step === "language") {
      await message.author.send(messages[locale].invalidChoice).catch(() => null);
      return true;
    }

    if (pending.step === "reason") {
      pending.reason = message.content.trim();
      await createTicketFromPending(message.author, pending);
      inMemory.pending.delete(message.author.id);
      return true;
    }

    return true;
  }

  async function sendPendingPrompt(user, pending) {
    const locale = getLocale(pending.language || "ar");
    const config = getGuildConfig(pending.guildId);
    if (pending.step === "language") {
      const embed = buildWelcomeEmbed(locale, config)
        .setTitle(messages[locale].chooseLanguageTitle)
        .setDescription(messages[locale].chooseLanguageBody);
      await user
        .send({
          embeds: [embed],
          components: buildLanguageButtons(),
        })
        .catch(() => null);
      return;
    }
    if (pending.step === "reason") {
      await user.send(messages[locale].askReason).catch(() => null);
    }
  }

  return { handlePendingFlow, sendPendingPrompt };
}

module.exports = { createPendingService };
