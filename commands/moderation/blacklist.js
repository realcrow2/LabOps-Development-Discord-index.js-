const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const config = require(path.resolve(__dirname, '../../config.json'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist a user by removing all roles and assigning a blacklist role.')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to blacklist')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for blacklist')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('access_approved')
        .setDescription('Access Approved?')
        .setRequired(true)),

  async execute(interaction) {
    // Check permission role
    const hasPerms = interaction.member.roles.cache.has(config.Moderation.blacklist.allowedRole);
    if (!hasPerms) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const accessApproved = interaction.options.getBoolean('access_approved');

    // Fetch member objects
    const executor = interaction.member;
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      return interaction.reply({ content: '❌ Target user not found in this server.', ephemeral: true });
    }

    // Role hierarchy check
    if (targetMember.roles.highest.position >= executor.roles.highest.position && interaction.guild.ownerId !== executor.id) {
      return interaction.reply({ content: '❌ You cannot blacklist a member with an equal or higher role than you.', ephemeral: true });
    }

    // Store roles before removal (exclude @everyone)
    const rolesBefore = targetMember.roles.cache.filter(r => r.id !== interaction.guild.id);

    // Remove all roles except @everyone
    try {
      await targetMember.roles.remove(rolesBefore);
    } catch (error) {
      return interaction.reply({ content: `❌ Failed to remove roles: ${error.message}`, ephemeral: true });
    }

    // Add blacklist role
    try {
      await targetMember.roles.add(config.Moderation.blacklist.blacklistRole);
    } catch (error) {
      return interaction.reply({ content: `❌ Failed to add blacklist role: ${error.message}`, ephemeral: true });
    }

    // Logging embed
    const logEmbed = new EmbedBuilder()
      .setTitle('🚫 User Blacklisted')
      .addFields(
        { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
        { name: 'Executor', value: `${executor.user.tag} (${executor.user.id})`, inline: true },
        { name: 'Server', value: interaction.guild.name, inline: true },
        { 
          name: 'Roles Before Blacklist', 
          value: rolesBefore.size > 0 ? rolesBefore.map(r => `<@&${r.id}>`).join(', ') : 'None' 
        },
        { name: 'Blacklist Reason', value: reason },
        { name: 'Access Approved', value: accessApproved ? 'True' : 'False' }
      )
      .setColor('Red')
      .setTimestamp();

    const logChannel = interaction.guild.channels.cache.get(config.Moderation.blacklist.logChannel);
    if (logChannel && logChannel.isTextBased() && logChannel.viewable) {
      await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
    }

    await interaction.reply({ content: `✅ Successfully blacklisted ${targetUser.tag}.`, ephemeral: true });
  }
};