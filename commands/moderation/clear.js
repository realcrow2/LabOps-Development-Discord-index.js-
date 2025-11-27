const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete a number of messages from the channel')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)),
  async execute(interaction) {
    // Check if user has the clear role
    if (!interaction.member.roles.cache.has(config.Moderation.clear.roleId)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');

    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: 'You must delete between 1 and 100 messages.', ephemeral: true });
    }

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);

      // Reply to the user
      await interaction.reply({ content: `Deleted ${deleted.size} messages.`, ephemeral: true });

      // Log the clear action in the log channel
      const logChannel = interaction.guild.channels.cache.get(config.Moderation.clear.logChannel);
      if (!logChannel) {
        console.warn('ClearLogsChannel not found or invalid in config.json');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('Messages Cleared')
        .setColor('Orange')
        .addFields(
          { name: 'Cleared By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
          { name: 'Channel', value: `${interaction.channel.name} (${interaction.channel.id})`, inline: true },
          { name: 'Amount', value: `${deleted.size}`, inline: true },
          { name: 'Time', value: new Date().toLocaleString(), inline: false },
        );

      await logChannel.send({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error trying to delete messages.', ephemeral: true });
    }
  },
};