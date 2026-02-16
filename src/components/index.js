const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const closeRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("ticket_close")
    .setLabel("Close")
    .setStyle(ButtonStyle.Danger),
  new ButtonBuilder()
    .setCustomId("ticket_close_reason")
    .setLabel("Close with Reason")
    .setStyle(ButtonStyle.Secondary)
);

const dmCloseRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("ticket_close_request")
    .setLabel("Close Ticket")
    .setStyle(ButtonStyle.Danger)
);

const ratingRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("ticket_rate:1").setLabel("1").setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId("ticket_rate:2").setLabel("2").setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId("ticket_rate:3").setLabel("3").setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId("ticket_rate:4").setLabel("4").setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId("ticket_rate:5").setLabel("5").setStyle(ButtonStyle.Success)
);

const closeConfirmRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("ticket_close_confirm")
    .setLabel("Confirm Close")
    .setStyle(ButtonStyle.Danger),
  new ButtonBuilder()
    .setCustomId("ticket_close_cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary)
);

const closedTicketControlsRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId("ticket_transcript")
    .setLabel("Transcript")
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId("ticket_delete_request")
    .setLabel("Delete")
    .setStyle(ButtonStyle.Danger)
);

const deleteConfirmRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("ticket_delete_confirm").setLabel("Confirm Delete").setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId("ticket_delete_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
);

function buildLanguageButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket_lang:ar").setLabel("\u0639\u0631\u0628\u064a").setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("ticket_lang:en")
        .setLabel("English")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function buildThreadComponents(ticket) {
  if (ticket.status === "closed") return [];
  if (ticket.claimedBy) {
    return [closeRow];
  }
  return [
    closeRow,
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

module.exports = {
  closeRow,
  dmCloseRow,
  ratingRow,
  closeConfirmRow,
  closedTicketControlsRow,
  deleteConfirmRow,
  buildLanguageButtons,
  buildThreadComponents,
};

