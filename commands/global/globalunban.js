const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const fs = require('fs');
const config = require('../../config.json');

function loadJsonSafe(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

function saveJsonSafe(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function userHasGlobalRole(member, allowedRoles) {
  return member.roles.cache.some(role => allowedRoles.includes(role.id));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('globalunban')
    .setDescription('Remove global ban from a user')
    .addUserOption(option => option.setName('user').setDescription('User to unban').setRequired(true)),

  async execute(interaction) {
    const globalRoles = loadJsonSafe('./GlobalRoles.json', {});
    const allowedRoles = globalRoles[interaction.guildId] || [];
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!userHasGlobalRole(member, allowedRoles)) {
      return interaction.reply({ content: '❌ You are not authorized to use this command.', flags: 64 });
    }

    const user = interaction.options.getUser('user');

    // Confirmation buttons
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('globalunban_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('globalunban_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
      );

    // Send initial confirmation message
    await interaction.reply({
      content: `Are you sure you want to globally unban **${user.tag}**?`,
      components: [buttons],
      flags: 64
    });

    // Create collector to listen for button clicks on this message only, 30s timeout
    const filter = i => 
      (i.customId === 'globalunban_confirm' || i.customId === 'globalunban_cancel') &&
      i.user.id === interaction.user.id;

    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'globalunban_cancel') {
        // User cancelled - update the message once
        return i.update({ content: '❌ Global unban cancelled.', components: [] });
      }

      if (i.customId === 'globalunban_confirm') {
        // Defer the update to give us time to process
        await i.deferUpdate();

        const linkedGuilds = loadJsonSafe('./Guild_Linked.json', []);
        let banData = loadJsonSafe('./Ban_File.json', []);

        // Migrate old object format to array format
        if (!Array.isArray(banData)) {
          banData = [];
        }

        if (!banData.includes(user.id)) {
          return interaction.editReply({ content: '⚠️ User is not globally banned.', components: [] });
        }

        const index = banData.indexOf(user.id);
        banData.splice(index, 1);
        saveJsonSafe('./Ban_File.json', banData);

        const failedGuilds = [];
        const successGuilds = [];

        for (const guildId of linkedGuilds) {
          const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
          if (!guild) continue;

          try {
            await guild.bans.remove(user.id, `Global unban by ${interaction.user.tag}`);
            successGuilds.push(guild.name || guildId);
          } catch (error) {
            if (!error.message.includes('Unknown Ban')) {
              failedGuilds.push(guild.name || guildId);
            }
          }
        }

        const embed = new EmbedBuilder()
          .setTitle('✅ GLOBAL UNBAN EXECUTED')
          .setColor('#00FF00')
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setDescription(`**A global unban has been processed successfully.**`)
          .addFields(
            { name: '👤 **User Unbanned**', value: `<@${user.id}> (${user.tag})`, inline: false },
            { name: '🛠️ **Unbanned By**', value: `${interaction.user} (${interaction.user.tag})`, inline: false },
            { name: '🌐 **Servers Processed**', value: `${successGuilds.length} server(s)`, inline: true },
            { name: '✅ **Successful**', value: successGuilds.length > 0 ? successGuilds.slice(0, 5).join(', ') : 'None', inline: false },
            { name: '⚠️ **Failed Guilds**', value: failedGuilds.length ? failedGuilds.join(', ') : 'None', inline: false },
            { name: '📅 **Time**', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
          )
          .setFooter({ text: 'Global Ban System | Unban Logged', iconURL: interaction.client.user.displayAvatarURL() });

        // Update the original interaction reply with results and remove buttons
        await interaction.editReply({ embeds: [embed], components: [], content: null });

        // Log in your configured log channel if available
        const logChannel = interaction.client.channels.cache.get(config.Logging.mainLogChannel);
        if (logChannel) {
          logChannel.send({ embeds: [embed] }).catch(console.error);
        }
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        // If no button was clicked within time, edit the original reply
        interaction.editReply({ content: '⏱️ Confirmation timed out. Global unban cancelled.', components: [] }).catch(() => {});
      }
    });
  }
};