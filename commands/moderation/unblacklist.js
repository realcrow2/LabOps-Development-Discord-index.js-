const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const config = require(path.resolve(__dirname, '../../config.json'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription('Remove blacklist role and restore member role.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to unblacklist')
        .setRequired(true)),

  async execute(interaction) {
    // Check if executor has BlackListPermsRoleID
    const hasPerms = interaction.member.roles.cache.has(config.Moderation.blacklist.allowedRole);
    if (!hasPerms) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const target = interaction.options.getUser('target');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: '❌ Target user not found in this server.', ephemeral: true });

    try {
      // Remove blacklist role
      await member.roles.remove(config.Moderation.blacklist.blacklistRole);
      // Add member role
      await member.roles.add(config.Verification.memberRoleId);
    } catch (error) {
      return interaction.reply({ content: `❌ Failed to update roles: ${error.message}`, ephemeral: true });
    }

    // Prepare embed for logging
    const logEmbed = new EmbedBuilder()
      .setTitle('✅ User Unblacklisted')
      .addFields(
        { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Executor', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
        { name: 'Server', value: interaction.guild.name, inline: true }
      )
      .setColor('Green')
      .setTimestamp();

    // Send log
    const logChannel = interaction.guild.channels.cache.get(config.Moderation.blacklist.logChannel);
    if (logChannel && logChannel.isTextBased() && logChannel.viewable) {
      await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
    }

    // Reply to command user
    await interaction.reply({ content: `✅ Successfully unblacklisted ${target.tag}.`, ephemeral: true });
  }
};