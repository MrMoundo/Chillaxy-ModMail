const { SlashCommandBuilder, ChannelType, REST, Routes } = require("discord.js");
const System = require("../../System/System");

function registerSlashCommands(client) {
  const commands = [
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("Configure the DM ticket bot")
      .addChannelOption((option) =>
        option
          .setName("support_channel")
          .setDescription("Channel for support threads")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addChannelOption((option) =>
        option
          .setName("logs_channel")
          .setDescription("Channel for ticket logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addRoleOption((option) =>
        option
          .setName("support_role")
          .setDescription("Role allowed to reply/close tickets")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("language")
          .setDescription("Default language")
          .addChoices(
            { name: "Arabic", value: "ar" },
            { name: "English", value: "en" }
          )
          .setRequired(true)
      )
      .addRoleOption((option) =>
        option
          .setName("mention_role")
          .setDescription("Role to mention on new tickets")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("embed_color")
          .setDescription("Embed color hex (e.g. #5865F2)")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("banner_url")
          .setDescription("Optional banner image URL for ticket embeds")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("set-admin-role")
      .setDescription("Set the admin role for ticket management")
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("Admin role for ticket management")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("config")
      .setDescription("Update or view ticket configuration")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Update ticket configuration")
          .addChannelOption((option) =>
            option
              .setName("support_channel")
              .setDescription("Channel for support threads")
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)
          )
          .addChannelOption((option) =>
            option
              .setName("logs_channel")
              .setDescription("Channel for ticket logs")
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)
          )
          .addRoleOption((option) =>
            option
              .setName("support_role")
              .setDescription("Role allowed to reply/close tickets")
              .setRequired(false)
          )
          .addRoleOption((option) =>
            option
              .setName("mention_role")
              .setDescription("Role to mention on new tickets")
              .setRequired(false)
          )
          .addRoleOption((option) =>
            option
              .setName("admin_role")
              .setDescription("Admin role for ticket management")
              .setRequired(false)
          )
          .addStringOption((option) =>
            option
              .setName("language")
              .setDescription("Default language")
              .addChoices(
                { name: "Arabic", value: "ar" },
                { name: "English", value: "en" }
              )
              .setRequired(false)
          )
          .addStringOption((option) =>
            option
              .setName("embed_color")
              .setDescription("Embed color hex (e.g. #5865F2)")
              .setRequired(false)
          )
          .addStringOption((option) =>
            option
              .setName("banner_url")
              .setDescription("Optional banner image URL for ticket embeds")
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("show")
          .setDescription("Show current ticket configuration")
      ),
    new SlashCommandBuilder()
      .setName("blacklist")
      .setDescription("Manage ticket blacklist")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add")
          .setDescription("Blacklist a user from creating tickets")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to blacklist")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason for blacklist")
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("remove")
          .setDescription("Remove a user from the blacklist")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to unblacklist")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("list")
          .setDescription("List blacklisted users")
      ),
    new SlashCommandBuilder()
      .setName("tempblacklist")
      .setDescription("Manage temporary ticket blacklist")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add")
          .setDescription("Temporarily blacklist a user from creating tickets")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to blacklist")
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("duration_minutes")
              .setDescription("Duration in minutes")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Reason for blacklist")
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("remove")
          .setDescription("Remove a user from temporary blacklist")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("User to unblacklist")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("list")
          .setDescription("List temporarily blacklisted users")
      ),
    new SlashCommandBuilder()
      .setName("toprank")
      .setDescription("Show top support members by handled tickets"),
    new SlashCommandBuilder()
      .setName("purge-user")
      .setDescription("Delete a user's ticket data")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("User to delete data for")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("close-all")
      .setDescription("Close all open tickets, log transcripts, and delete threads"),
    new SlashCommandBuilder()
      .setName("voice")
      .setDescription("Set or clear the voice channel the bot stays in")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set the voice channel to stay in")
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Voice channel")
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("clear")
          .setDescription("Clear the voice channel and leave")
      ),
    new SlashCommandBuilder()
      .setName("bot-status")
      .setDescription("Change the bot presence status")
      .addStringOption((option) =>
        option
          .setName("status")
          .setDescription("Presence status")
          .addChoices(
            { name: "Online", value: "online" },
            { name: "Do Not Disturb", value: "dnd" },
            { name: "Sleep", value: "sleep" },
            { name: "Offline", value: "offline" }
          )
          .setRequired(true)
      ),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(System.token);
  return rest.put(Routes.applicationCommands(client.user.id), { body: commands });
}

module.exports = { registerSlashCommands };
