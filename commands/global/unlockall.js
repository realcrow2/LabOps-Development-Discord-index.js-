const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const config = require(path.resolve(__dirname, '../../config.json'));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlockall')
    .setDescription('🔓 Unlock all text channels across all servers (Owner only)'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.editReply({ content: '❌ Only the server owner can use this command.' });
    }

    const client = interaction.client;
    let guildSuccessCount = 0;
    let guildFailCount = 0;
    let totalChannelFailCount = 0;

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        await guild.channels.fetch();

        const textChannels = guild.channels.cache.filter(
          ch => ch.isTextBased() && ch.viewable
        );

        let guildChannelFail = 0;

        for (const [, channel] of textChannels) {
          try {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
          } catch (err) {
            console.warn(`Could not unlock channel ${channel.name} in ${guild.name}:`, err);
            guildChannelFail++;
            totalChannelFailCount++;
          }
        }

        // Logging with fallback:
        let logChannel = guild.channels.cache.get(config.Moderation.lock.logChannel);
        if (!logChannel || !logChannel.isTextBased() || !logChannel.viewable) {
          // fallback: search for any channel with "log" in the name
          logChannel = guild.channels.cache.find(ch =>
            ch.name.toLowerCase().includes('log') && ch.isTextBased() && ch.viewable
          );
        }

        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🔓 Command Executed: /unlockall')
            .setDescription(`Executor: ${interaction.user.tag} (${interaction.user.id})`)
            .addFields(
              { name: 'Server', value: guild.name, inline: true },
              { name: 'Channels Unlocked', value: `${textChannels.size - guildChannelFail}`, inline: true },
              { name: 'Channels Failed', value: `${guildChannelFail}`, inline: true }
            )
            .setColor('Green')
            .setTimestamp();

          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        if (guildChannelFail === 0) guildSuccessCount++;
        else guildFailCount++;

      } catch (err) {
        console.error(`Failed to process guild ${guild.name}:`, err);
        guildFailCount++;
      }
    }

    const replyEmbed = new EmbedBuilder()
      .setTitle('🔓 /unlockall Complete')
      .setDescription(`Servers fully unlocked: **${guildSuccessCount}**\nServers with errors: **${guildFailCount}**\nChannels failed to unlock: **${totalChannelFailCount}**`)
      .setColor('Green')
      .setTimestamp();

    await interaction.editReply({ embeds: [replyEmbed] });
  }
};