const { EmbedBuilder } = require("discord.js");
const messages = require("../messages");
const { formatEta, randomColor } = require("../utils");

function applyBanner(embed, config) {
  if (config?.bannerUrl) {
    embed.setImage(config.bannerUrl);
  }
  return embed;
}

function buildTicketEmbed(ticket, user, config, locale) {
  const embed = new EmbedBuilder()
    .setTitle(`Ticket ${ticket.id}`)
    .setDescription("```\nOfficial Ticket Details\n```")
    .setColor(config.embedColor || "#5865F2")
    .addFields(
      {
        name: "User",
        value: `${user.tag}
\`${user.id}\``,
      },
      {
        name: "Status",
        value: ticket.status.toUpperCase(),
      },
      {
        name: "Reason",
        value: ticket.reason,
      },
      {
        name: "Ticket Number",
        value: `#${ticket.number}`,
      },
      {
        name: "Opened At",
        value: `<t:${Math.floor(ticket.openedAt / 1000)}:F>`,
      },
      ...(ticket.closedAt
        ? [
            {
              name: "Closed At",
              value: `<t:${Math.floor(ticket.closedAt / 1000)}:F>`,
            },
          ]
        : []),
      {
        name: "Access",
        value: config.supportRoleIds.length
          ? config.supportRoleIds.map((id) => `<@&${id}>`).join(" ")
          : "Server management",
      },
      {
        name: "Claimed By",
        value: ticket.claimedByTag || "-",
      },
      {
        name: "Closed By",
        value: ticket.closedByTag || "-",
      }
    )
    .setTimestamp(ticket.openedAt);
  return applyBanner(embed, config);
}

function buildWelcomeEmbed(locale, config) {
  const embed = new EmbedBuilder()
    .setTitle(messages[locale].ticketPromptTitle)
    .setDescription(messages[locale].ticketPromptBody)
    .setColor(0x2f3136);
  return applyBanner(embed, config);
}

function buildAwaitingEmbed(locale, etaMinutes, config) {
  const body = messages[locale].awaitingBody.replace("{eta}", formatEta(etaMinutes));
  const embed = new EmbedBuilder()
    .setTitle(messages[locale].awaitingTitle)
    .setDescription(body)
    .setColor(0x2f3136);
  return applyBanner(embed, config);
}


function buildFeedbackEmbed(ticket, rating, feedback) {
  return new EmbedBuilder()
    .setTitle("Ticket Feedback")
    .setColor(randomColor())
    .addFields(
      { name: "Ticket", value: `#${ticket.number}` },
      { name: "User", value: `${ticket.userTag} (${ticket.userId})` },
      { name: "Rating", value: String(rating || "-") },
      { name: "Feedback", value: feedback || "-" }
    )
    .setTimestamp();
}


function buildTicketLogEmbed(ticket, locale) {
  const isAr = locale === "ar";
  return new EmbedBuilder()
    .setTitle(isAr ? "\u062d\u0641\u0638 \u0627\u0644\u062a\u0643\u062a" : "Ticket Saved")
    .setColor(randomColor())
    .addFields(
      { name: isAr ? "\u0631\u0642\u0645 \u0627\u0644\u062a\u0643\u062a" : "Ticket ID", value: `#${ticket.number}` },
      { name: isAr ? "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645" : "User", value: `${ticket.userTag} (${ticket.userId})` },
      { name: isAr ? "\u0627\u0644\u062d\u0627\u0644\u0629" : "Status", value: ticket.status.toUpperCase() },
      {
        name: isAr ? "\u0633\u0628\u0628 \u0627\u0644\u0625\u063a\u0644\u0627\u0642" : "Close Reason",
        value: ticket.closeReason || (isAr ? "\u063a\u064a\u0631 \u0645\u062d\u062f\u062f" : "Not specified"),
      },
      {
        name: isAr ? "\u0641\u062a\u062d\u062a \u0641\u064a" : "Opened At",
        value: ticket.openedAt ? `<t:${Math.floor(ticket.openedAt / 1000)}:F>` : "-",
      },
      {
        name: isAr ? "\u062a\u0645 \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645 \u0641\u064a" : "Claimed/First Response",
        value: ticket.claimedAt
          ? `<t:${Math.floor(ticket.claimedAt / 1000)}:F>`
          : ticket.firstResponseAt
            ? `<t:${Math.floor(ticket.firstResponseAt / 1000)}:F>`
            : "-",
      },
      {
        name: isAr ? "\u0623\u063a\u0644\u0642\u062a \u0641\u064a" : "Closed At",
        value: ticket.closedAt ? `<t:${Math.floor(ticket.closedAt / 1000)}:F>` : "-",
      },
      {
        name: isAr ? "\u0627\u0644\u062a\u0642\u064a\u064a\u0645" : "Rating",
        value: ticket.rating ? String(ticket.rating) : (isAr ? "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062a\u0642\u064a\u064a\u0645" : "Not rated"),
      },
      {
        name: isAr ? "\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a" : "Feedback",
        value: ticket.feedback ? String(ticket.feedback) : (isAr ? "\u0644\u0627 \u062a\u0648\u062c\u062f" : "None"),
      }
    )
    .setTimestamp();
}

function buildRatingLogEmbed(ticket, rating, feedback, locale) {
  const isAr = locale === "ar";
  return new EmbedBuilder()
    .setTitle(isAr ? "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0642\u064a\u064a\u0645" : "Rating Saved")
    .setColor(randomColor())
    .addFields(
      { name: isAr ? "\u0631\u0642\u0645 \u0627\u0644\u062a\u0643\u062a" : "Ticket ID", value: `#${ticket.number}` },
      { name: isAr ? "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645" : "User", value: `${ticket.userTag} (${ticket.userId})` },
      { name: isAr ? "\u0627\u0644\u062a\u0642\u064a\u064a\u0645" : "Rating", value: String(rating || "-") },
      { name: isAr ? "\u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0627\u062a" : "Feedback", value: feedback || (isAr ? "\u0644\u0627 \u062a\u0648\u062c\u062f" : "None") }
    )
    .setTimestamp();
}

function buildClosedEmbed(locale, ticket, config) {
  const durationMinutes = ticket.closedAt
    ? Math.max(1, Math.round((ticket.closedAt - ticket.openedAt) / 60000))
    : 1;
  const localeKey = messages[locale] ? locale : "en";
  const localeMessages = messages[localeKey] || messages.en;
  const safeThanks =
    localeMessages.closedEmbedThanks || messages.en.closedEmbedThanks || "Thank you for contacting support.";
  const durationUnit =
    localeMessages.closedEmbedDurationUnit || messages.en.closedEmbedDurationUnit || "minute(s)";
  const durationLabel = `${durationMinutes} ${durationUnit}`;
  const hasReason = Boolean(ticket.closeReason);
  const embed = new EmbedBuilder()
    .setTitle(localeMessages.closedEmbedTitle)
    .setDescription(safeThanks)
    .setColor(randomColor())
    .addFields(
      {
        name: localeMessages.closedEmbedTicketId || messages.en.closedEmbedTicketId || "Ticket ID",
        value: `#${ticket.number}`,
      },
      {
        name: localeMessages.closedEmbedIssueSolved || messages.en.closedEmbedIssueSolved || "Issue solved in",
        value: durationLabel
      },
      ...(hasReason
        ? [
            {
              name: locale === "ar" ? "سبب الإغلاق" : "Close Reason",
              value: String(ticket.closeReason).slice(0, 1024),
            },
          ]
        : []),
      {
        name: localeMessages.closedEmbedComplaint || messages.en.closedEmbedComplaint || "For any complaint, use the ticket ID",
        value: `#${ticket.number}`,
      },
      {
        name: localeMessages.closedEmbedRate || messages.en.closedEmbedRate || "Please rate the support",
        value: localeMessages.closedEmbedRateValue || messages.en.closedEmbedRateValue || "From 1 to 5",
      }
    )
    .setTimestamp(ticket.closedAt || Date.now());
  return applyBanner(embed, config);
}

function buildClosedControlsEmbed(locale, ticket, config) {
  const isAr = locale === "ar";
  const title = isAr ? "لوحة التحكم بالتذكرة المغلقة" : "Closed Ticket Controls";
  const description = isAr
    ? "استخدم الأزرار أدناه لحفظ نسخة المحادثة أو حذف التذكرة."
    : "Use the buttons below to save a transcript or delete the ticket.";
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(randomColor())
    .addFields(
      { name: isAr ? "معرف التذكرة" : "Ticket ID", value: `#${ticket.number}` },
      { name: isAr ? "الحالة" : "Status", value: ticket.status.toUpperCase() }
    )
    .setTimestamp();
  return applyBanner(embed, config);
}

function buildTranscriptEmbed(ticket, locale, config, savedBy) {
  const isAr = locale === "ar";
  const ratingValue = ticket.rating ? String(ticket.rating) : (isAr ? "غير مُقيّم" : "Not rated");
  const feedbackValue = ticket.feedback ? String(ticket.feedback) : (isAr ? "لا يوجد" : "None");
  const embed = new EmbedBuilder()
    .setTitle(isAr ? "نسخة المحادثة محفوظة" : "Transcript Saved")
    .setDescription(
      isAr
        ? "تم حفظ نسخة المحادثة الخاصة بهذه التذكرة."
        : "The transcript for this ticket has been saved."
    )
    .setColor(randomColor())
    .addFields(
      { name: isAr ? "معرف التذكرة" : "Ticket ID", value: `#${ticket.number}` },
      { name: isAr ? "المستخدم" : "User", value: `${ticket.userTag} (${ticket.userId})` },
      { name: isAr ? "الحالة" : "Status", value: ticket.status.toUpperCase() },
      { name: isAr ? "التقييم" : "Rating", value: ratingValue },
      { name: isAr ? "الملاحظات" : "Feedback", value: feedbackValue }
    )
    .setTimestamp();
  const savedByTag = savedBy?.tag || ticket.logTranscriptSavedByTag;
  const savedById = savedBy?.id || ticket.logTranscriptSavedById;
  if (savedByTag && savedById) {
    embed.addFields({
      name: isAr ? "Ù…Ù† Ø­ÙØ¸ Ø§Ù„Ù†Ø³Ø®Ø©" : "Saved By",
      value: `${savedByTag} (${savedById})`,
    });
  }
  return applyBanner(embed, config);
}

module.exports = {
  buildTicketEmbed,
  buildWelcomeEmbed,
  buildAwaitingEmbed,
  buildClosedEmbed,
  buildClosedControlsEmbed,
  buildFeedbackEmbed,
  buildTicketLogEmbed,
  buildTranscriptEmbed,
  buildRatingLogEmbed,
};

