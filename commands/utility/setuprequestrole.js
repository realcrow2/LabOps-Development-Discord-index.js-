const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../../data/roleRequests.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(dbPath, JSON.stringify(config, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setuprequestrole")
    .setDescription("Configure role request system for this guild.")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Channel where role requests should be sent")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName("approverrole1")
        .setDescription("First role allowed to approve requests")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName("approverrole2")
        .setDescription("Optional approver role")
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName("approverrole3")
        .setDescription("Optional approver role")
        .setRequired(false)
    ),

  async execute(interaction) {
    // ✅ Restrict command usage to a single user ID
    if (interaction.user.id !== "1228084539138506845") {
      return interaction.reply({
        content: "❌ You are not authorized to use this command.",
        ephemeral: true,
      });
    }

    const config = loadConfig();
    const channel = interaction.options.getChannel("channel");
    const roles = [
      interaction.options.getRole("approverrole1"),
      interaction.options.getRole("approverrole2"),
      interaction.options.getRole("approverrole3"),
    ].filter(r => r);

    config[interaction.guild.id] = {
      channelId: channel.id,
      approverRoles: roles.map(r => r.id),
    };

    saveConfig(config);

    return interaction.reply({
      content: `✅ Role request system configured.\n**Channel:** ${channel}\n**Approver Roles:** ${roles.map(r => r).join(", ")}`,
      ephemeral: true,
    });
  },
};