const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');
const config = require('../../config.json');

// --- Cooldowns Map (in memory) ---
const cooldowns = new Map();

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

// Store pending ban actions
function savePendingAction(messageId, userId, channelId) {
  const pending = loadJsonSafe('./Pending_Bans.json', {});
  pending[messageId] = { userId, channelId, timestamp: Date.now() };
  saveJsonSafe('./Pending_Bans.json', pending);
}

function removePendingAction(messageId) {
  const pending = loadJsonSafe('./Pending_Bans.json', {});
  delete pending[messageId];
  saveJsonSafe('./Pending_Bans.json', pending);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('globalban')
    .setDescription('Globally ban a user')
    .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(false)),

  async execute(interaction) {
    const globalRoles = loadJsonSafe('./GlobalRoles.json', {});
    const allowedRoles = globalRoles[interaction.guildId] || [];
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!userHasGlobalRole(member, allowedRoles)) {
      return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
    }

    // --- Cooldown Check (10 minutes) ---
    const cooldownTime = 10 * 60 * 1000; // 10 minutes
    const userId = interaction.user.id;

    if (userId !== "1228084539138506845") { // bypass for this ID
      const lastUsed = cooldowns.get(userId) || 0;
      const now = Date.now();

      if (now - lastUsed < cooldownTime) {
        const remaining = Math.ceil((cooldownTime - (now - lastUsed)) / 1000);
        return interaction.reply({
          content: `⏳ You must wait **${Math.floor(remaining / 60)}m ${remaining % 60}s** before using this command again.`,
          ephemeral: true
        });
      }

      cooldowns.set(userId, now);
    }
    // -----------------------------------

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Prevent self-ban
    if (user.id === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot ban yourself!', flags: 64 });
    }

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
      );

    await interaction.reply({
      content: `Are you sure you want to **globally ban** ${user.tag}?`,
      components: [buttons],
      flags: 64,
    });

    const filter = i => ['confirm', 'cancel'].includes(i.customId) && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async i => {
      if (i.customId === 'cancel') {
        return i.update({ content: '❌ Global ban cancelled.', components: [] });
      }

      if (i.customId === 'confirm') {
        await i.deferUpdate();

        const linkedGuilds = loadJsonSafe('./Guild_Linked.json', []);
        let banData = loadJsonSafe('./Ban_File.json', []);

        // Migrate old object format to array format
        if (!Array.isArray(banData)) {
          banData = [];
        }

        if (banData.includes(user.id)) {
          return i.editReply({ content: '⚠️ User is already globally banned.', components: [] });
        }

        banData.push(user.id);
        saveJsonSafe('./Ban_File.json', banData);

        const failedGuilds = [];
        const successGuilds = [];
        
        for (const guildId of linkedGuilds) {
          const guild = interaction.client.guilds.cache.get(guildId);
          if (!guild) continue;

          try {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (member) {
              await member.ban({ reason: `Global ban by ${interaction.user.tag}: ${reason}` });
            } else {
              await guild.members.ban(user.id, { reason: `Global ban by ${interaction.user.tag}: ${reason}` });
            }
            successGuilds.push(guild.name || guildId);
          } catch {
            failedGuilds.push(guild.name || guildId);
          }
        }

        const embed = new EmbedBuilder()
          .setTitle('🚫 GLOBAL BAN EXECUTED')
          .setColor('#FF073A')
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setDescription(`**A global ban has been processed successfully.**`)
          .addFields(
            { name: '👤 **User Banned**', value: `<@${user.id}> (${user.tag})`, inline: false },
            { name: '🛠️ **Banned By**', value: `${interaction.user} (${interaction.user.tag})`, inline: false },
            { name: '📜 **Reason**', value: `\`\`\`${reason}\`\`\``, inline: false },
            { name: '🌐 **Servers Affected**', value: `${successGuilds.length} server(s)`, inline: true },
            { name: '✅ **Successful**', value: successGuilds.length > 0 ? successGuilds.slice(0, 5).join(', ') : 'None', inline: false },
            { name: '⚠️ **Failed Guilds**', value: failedGuilds.length ? failedGuilds.join(', ') : 'None', inline: false },
            { name: '📅 **Time**', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
          )
          .setFooter({ text: 'Global Ban System | Action Logged', iconURL: interaction.client.user.displayAvatarURL() });

        await i.editReply({ content: null, embeds: [embed], components: [] });

        const logChannel = interaction.client.channels.cache.get(config.Logging.mainLogChannel);
        if (logChannel) {
          try {
            const actionButtons = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder().setCustomId(`approve_${user.id}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`revoke_${user.id}`).setLabel('❌ Revoke').setStyle(ButtonStyle.Danger),
              );

            const logMessage = await logChannel.send({ embeds: [embed], components: [actionButtons] });

            // Save pending action for persistence
            savePendingAction(logMessage.id, user.id, logChannel.id);

            // Start thread for evidence
            const thread = await logMessage.startThread({
              name: `Evidence: ${user.tag}`,
              autoArchiveDuration: 1440,
            });

            await thread.send({
              content:
`📌 **Provide the following evidence for this global ban:**
• Screenshots of misconduct  
• Video clips if available  
• Chat logs or transcripts  
• Any additional context`
            });
          } catch (err) {
            console.error('Failed to send log message:', err);
          }
        }
      }
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        try {
          await interaction.editReply({ content: '⏱️ Confirmation timed out. Global ban cancelled.', components: [] });
        } catch {}
      }
    });
  },
};