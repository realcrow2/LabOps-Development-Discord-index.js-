const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadConfig() {
  try {
    return require(path.join(process.cwd(), 'config.json'));
  } catch {
    return {};
  }
}

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

async function checkAltAccount(member) {
  const config = loadConfig();
  
  if (!config.AltChecker?.logChannel || !config.AltChecker?.accountAgeDays) {
    return;
  }

  const accountCreatedAt = member.user.createdAt;
  const now = new Date();
  const accountAgeDays = Math.floor((now - accountCreatedAt) / (1000 * 60 * 60 * 24));

  if (accountAgeDays >= config.AltChecker.accountAgeDays) {
    return;
  }

  const logChannel = member.guild.channels.cache.get(config.AltChecker.logChannel);
  if (!logChannel) {
    console.error('Alt checker log channel not found');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('⚠️ New Account Detected')
    .setColor('Yellow')
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
      { name: 'Mention', value: `${member}`, inline: true },
      { name: 'Account Age', value: `${accountAgeDays} day${accountAgeDays !== 1 ? 's' : ''} old`, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(accountCreatedAt.getTime() / 1000)}:F>`, inline: false },
      { name: 'Joined Server', value: `<t:${Math.floor(now.getTime() / 1000)}:F>`, inline: false }
    )
    .setFooter({ text: `User ID: ${member.user.id}` })
    .setTimestamp();

  const buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`altapprove_${member.user.id}`)
        .setLabel('✅ Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`altdeny_${member.user.id}`)
        .setLabel('❌ Deny')
        .setStyle(ButtonStyle.Danger)
    );

  const pendingAltChecks = loadJsonSafe('./Pending_Alt_Checks.json', {});
  pendingAltChecks[member.user.id] = {
    userId: member.user.id,
    guildId: member.guild.id,
    accountAge: accountAgeDays,
    joinedAt: now.toISOString()
  };
  saveJsonSafe('./Pending_Alt_Checks.json', pendingAltChecks);

  await logChannel.send({
    embeds: [embed],
    components: [buttons]
  });

  console.log(`🚨 Alt detection flagged: ${member.user.tag} (${accountAgeDays} days old)`);
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const autoRoleFilePath = './autoroleConfig.json';
    if (fs.existsSync(autoRoleFilePath)) {
      const autoRoleConfig = JSON.parse(fs.readFileSync(autoRoleFilePath, 'utf8'));
      const roleId = autoRoleConfig[member.guild.id];

      if (roleId) {
        try {
          const role = member.guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.add(role);
            console.log(`✅ Gave role ${role.name} to ${member.user.tag}`);
          }
        } catch (err) {
          console.error(`❌ Failed to give autorole:`, err);
        }
      }
    }

    await checkAltAccount(member);
  }
};