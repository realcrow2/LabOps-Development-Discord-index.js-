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
    .setName('listlinkedguilds')
    .setDescription('List all linked servers for global bans'),

  async execute(interaction) {
    const linkedGuilds = loadJsonSafe('./Guild_Linked.json', []);
    const globalRoles = loadJsonSafe('./GlobalRoles.json', {});
    const executorId = interaction.user.id;

    if (linkedGuilds.length === 0) {
      return interaction.reply({ content: '⚠️ No servers are currently linked for global bans.', ephemeral: true });
    }

    // Find servers where the executor is owner OR has global mod role
    const accessibleGuilds = [];
    const inaccessibleGuilds = [];
    
    for (const guildId of linkedGuilds) {
      const guild = interaction.client.guilds.cache.get(guildId);
      if (!guild) {
        inaccessibleGuilds.push({ id: guildId, name: 'Unknown Guild', accessible: false });
        continue;
      }
      
      // Check if executor is owner
      if (guild.ownerId === executorId) {
        accessibleGuilds.push({ id: guildId, name: guild.name, accessible: true, reason: 'Owner' });
        continue;
      }
      
      // Check if executor has global mod role in this guild
      const guildGlobalRoles = globalRoles[guildId] || [];
      try {
        const executorMember = await guild.members.fetch(executorId).catch(() => null);
        if (executorMember) {
          const hasGlobalRole = executorMember.roles.cache.some(role => guildGlobalRoles.includes(role.id));
          if (hasGlobalRole) {
            accessibleGuilds.push({ id: guildId, name: guild.name, accessible: true, reason: 'Global Mod' });
            continue;
          }
        }
      } catch {
        // Can't fetch member
      }
      
      inaccessibleGuilds.push({ id: guildId, name: guild.name, accessible: false });
    }

    let description = '';
    
    if (accessibleGuilds.length > 0) {
      description += '**✅ Servers You Can Ban From:**\n';
      accessibleGuilds.forEach((guild, index) => {
        description += `${index + 1}. **${guild.name}** (\`${guild.id}\`) - ${guild.reason}\n`;
      });
      description += '\n';
    }
    
    if (inaccessibleGuilds.length > 0) {
      description += '**❌ Servers You Cannot Ban From:**\n';
      inaccessibleGuilds.forEach((guild, index) => {
        description += `${index + 1}. **${guild.name}** (\`${guild.id}\`)\n`;
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🌐 Linked Servers')
      .setColor(accessibleGuilds.length > 0 ? '#00BFFF' : '#FF6B6B')
      .setDescription(description || 'No accessible servers found.')
      .addFields(
        { name: 'Total Linked', value: `${linkedGuilds.length}`, inline: true },
        { name: 'You Can Access', value: `${accessibleGuilds.length}`, inline: true },
        { name: 'You Cannot Access', value: `${inaccessibleGuilds.length}`, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};