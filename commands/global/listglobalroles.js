const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

function loadJsonSafe(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listglobalroles')
    .setDescription('List all global mod roles in every server'),

  async execute(interaction) {
    const globalRoles = loadJsonSafe('./GlobalRoles.json', {});
    const guilds = Object.entries(globalRoles);

    if (guilds.length === 0) {
      return interaction.reply({ content: '❌ No global mod roles have been set in any server.', ephemeral: true });
    }

    let description = '';

    for (const [guildId, roleIds] of guilds) {
      if (roleIds.length === 0) continue;

      description += `**Server ID:** ${guildId}\n`;
      description += roleIds.map(roleId => `• Role ID: ${roleId}`).join('\n');
      description += '\n\n';
    }

    if (description === '') {
      description = '❌ No global mod roles have been set in any server.';
    }

    const embed = new EmbedBuilder()
      .setTitle('🌐 All Global Roles')
      .setDescription(description)
      .setColor('Green')
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};