const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const config = require(path.resolve(__dirname, '../../config.json'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode delay (seconds) for this channel')
    .addIntegerOption(option =>
      option.setName('seconds')
        .setDescription('Number of seconds for slowmode (0 to 21600)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  async execute(interaction) {
    const allowedRoles = config.Moderation.slowmode.allowedRoles;
    const memberRoles = interaction.member.roles.cache;
    const hasPermission = memberRoles.some(role => allowedRoles.includes(role.id));

    if (!hasPermission) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const seconds = interaction.options.getInteger('seconds');

    try {
      await interaction.channel.setRateLimitPerUser(seconds);

      // Confirmation embed to user
      const confirmEmbed = new EmbedBuilder()
        .setTitle('🐢 Slowmode Updated')
        .setDescription(`Slowmode for this channel set to **${seconds} second${seconds !== 1 ? 's' : ''}**.`)
        .setColor('Blue')
        .setTimestamp();

      await interaction.reply({ embeds: [confirmEmbed] });

      // Logging embed
      const logChannel = interaction.guild.channels.cache.get(config.Moderation.slowmode.logChannel);
      if (logChannel && logChannel.isTextBased() && logChannel.viewable) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🐢 Slowmode Changed')
          .addFields(
            { name: 'Channel', value: `${interaction.channel}`, inline: true },
            { name: 'Changed By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: 'New Slowmode', value: `${seconds} second${seconds !== 1 ? 's' : ''}`, inline: true }
          )
          .setColor('Blue')
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }

    } catch (error) {
      console.error('Error setting slowmode:', error);
      await interaction.reply({ content: '❌ Failed to set slowmode. Make sure I have permission to manage this channel.', ephemeral: true });
    }
  }
};