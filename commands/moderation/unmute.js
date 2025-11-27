const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('node:path');
const config = require(path.join(process.cwd(), 'config.json'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Member to unmute')
        .setRequired(true)),
  
  async execute(interaction) {
    if (!interaction.member.roles.cache.has(config.Moderation.unmute.roleId)) {
      return interaction.reply({ content: '❌ You do not have permission to unmute members.', ephemeral: true });
    }

    const target = interaction.options.getMember('target');
    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });

    if (!target.isCommunicationDisabled()) {
      return interaction.reply({ content: '⚠️ This member is not currently muted.', ephemeral: true });
    }

    try {
      await target.timeout(null); // ✅ Removes timeout

      // ✅ Build a beautiful embed for logs and DM
      const embed = new EmbedBuilder()
        .setTitle('🔊 Member Unmuted')
        .setColor(0x00FF00) // Green for success
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Member', value: `${target.user.tag} (${target.id})`, inline: true },
          { name: '👮 Unmuted By', value: `${interaction.user.tag}`, inline: true },
          { name: '🕒 Time', value: new Date().toLocaleString(), inline: false }
        )
        .setFooter({ text: `ID: ${target.id}` })
        .setTimestamp();

      // ✅ Send ephemeral confirmation to moderator
      await interaction.reply({ content: `✅ ${target.user.tag} has been unmuted.`, ephemeral: true });

      // ✅ DM the unmuted user
      try {
        await target.send({
          content: `✅ You have been unmuted in **${interaction.guild.name}**.`,
          embeds: [embed]
        });
      } catch {
        console.warn(`⚠️ Could not DM ${target.user.tag}.`);
      }

      // ✅ Log the unmute action in staff log channel
      const logChannel = interaction.guild.channels.cache.get(config.Moderation.unmute.logChannel);
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

    } catch (error) {
      console.error(error);
      await interaction.reply({ content: '❌ Failed to unmute the member.', ephemeral: true });
    }
  },
};