const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");
const config = require("../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roleall")
    .setDescription("Assign a role to everyone in the server.")
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("The role to give to everyone")
        .setRequired(true)
    ),

  async execute(interaction) {
    const role = interaction.options.getRole("role");
    const member = interaction.member;

    // 🔒 Check if user has the required role
    if (!member.roles.cache.has(config.RoleManagement.roleAll.allowedRole)) {
      return interaction.reply({
        content: "❌ You are not authorized to use this command.",
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⏳ Assigning Role to Everyone")
          .setDescription(`Applying ${role} to all members...`)
          .setColor("Yellow")
      ],
      ephemeral: true
    });

    let successCount = 0;
    let failCount = 0;

    const members = await interaction.guild.members.fetch();

    for (const [id, guildMember] of members) {
      try {
        if (!guildMember.user.bot) {
          await guildMember.roles.add(role);
          successCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    // ✅ Confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setTitle("✅ Role Assignment Completed")
      .setDescription(`Role ${role} has been given to **${successCount}** members.`)
      .setColor("Green")
      .addFields(
        { name: "Successful", value: `${successCount}`, inline: true },
        { name: "Failed", value: `${failCount}`, inline: true }
      )
      .setTimestamp();

    await interaction.followUp({ embeds: [confirmEmbed], ephemeral: false });

    // 📝 Log embed
    const logChannel = interaction.guild.channels.cache.get(config.RoleManagement.roleAll.logChannel);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("📢 Role All Command Used")
        .setColor("Blue")
        .addFields(
          { name: "Executor", value: `${interaction.user}`, inline: true },
          { name: "Role Given", value: `${role}`, inline: true },
          { name: "Members Affected", value: `${successCount}`, inline: true }
        )
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] });
    }
  }
};