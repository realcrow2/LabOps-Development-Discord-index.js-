const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../../data/autoRoles.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setupautorole")
    .setDescription("Configure auto role assignment for new members")
    .addRoleOption(option =>
      option.setName("role")
        .setDescription("The role to automatically assign to new members")
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option.setName("enabled")
        .setDescription("Enable or disable auto role (default: true)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const role = interaction.options.getRole("role");
    const enabled = interaction.options.getBoolean("enabled") ?? true;

    // Check if bot can assign this role
    const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
    const botHighestRole = botMember.roles.highest;

    if (role.position >= botHighestRole.position) {
      return interaction.reply({
        content: "❌ I cannot assign this role because it is higher than or equal to my highest role in the role hierarchy.",
        flags: 64
      });
    }

    if (role.managed) {
      return interaction.reply({
        content: "❌ This role is managed by an integration and cannot be assigned manually.",
        flags: 64
      });
    }

    if (role.id === interaction.guild.id) {
      return interaction.reply({
        content: "❌ You cannot use @everyone as an auto role.",
        flags: 64
      });
    }

    const config = loadConfig();

    if (enabled) {
      config[interaction.guild.id] = {
        roleId: role.id,
        roleName: role.name,
        enabled: true,
        setupBy: interaction.user.id,
        setupAt: new Date().toISOString()
      };

      saveConfig(config);

      const embed = new EmbedBuilder()
        .setTitle("✅ Auto Role Configured")
        .setColor("Green")
        .addFields(
          { name: "Role", value: `${role}`, inline: true },
          { name: "Status", value: "✅ Enabled", inline: true },
          { name: "Server", value: interaction.guild.name, inline: false }
        )
        .setFooter({ text: `Setup by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        flags: 64
      });
    } else {
      if (config[interaction.guild.id]) {
        delete config[interaction.guild.id];
        saveConfig(config);

        const embed = new EmbedBuilder()
          .setTitle("🔴 Auto Role Disabled")
          .setColor("Red")
          .addFields(
            { name: "Status", value: "Auto role has been disabled for this server" }
          )
          .setFooter({ text: `Disabled by ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          flags: 64
        });
      } else {
        return interaction.reply({
          content: "❌ Auto role is not configured for this server.",
          flags: 64
        });
      }
    }
  },
};