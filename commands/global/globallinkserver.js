const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const config = require('../../config.json');

function loadJsonSafe(filePath, fallbackValue) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch {
    return fallbackValue;
  }
}

function saveJsonSafe(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('globallinkserver')
    .setDescription('Link this server for global bans (only for authorized user)')
    .addStringOption(option => option.setName('guildid').setDescription('Guild ID to link').setRequired(true)),

  async execute(interaction) {
    // Check link permissions
    const linkPermissions = loadJsonSafe('./Link_Permissions.json', { allowedUsers: [], allowedRoles: {} });
    const member = await interaction.guild.members.fetch(interaction.user.id);
    
    const hasUserPermission = linkPermissions.allowedUsers.includes(interaction.user.id);
    const guildAllowedRoles = linkPermissions.allowedRoles[interaction.guildId] || [];
    const hasRolePermission = member.roles.cache.some(role => guildAllowedRoles.includes(role.id));
    
    if (!hasUserPermission && !hasRolePermission) {
      return interaction.reply({ 
        content: '❌ You are not authorized to use this command. Ask the server owner to add you with `/setlinkpermission`.', 
        ephemeral: true 
      });
    }

    const guildId = interaction.options.getString('guildid');
    const linkedGuilds = loadJsonSafe('./Guild_Linked.json', []);

    if (linkedGuilds.includes(guildId)) {
      return interaction.reply({ content: 'ℹ️ This guild is already linked.', ephemeral: true });
    }

    linkedGuilds.push(guildId);
    fs.writeFileSync('./Guild_Linked.json', JSON.stringify(linkedGuilds, null, 2));
    await interaction.reply({ content: `✅ Guild \`${guildId}\` has been linked.`, ephemeral: true });

    // Use the dedicated GlobalLink_log channel instead of logChannelId
    const logChannel = interaction.client.channels.cache.get(config.Logging.globalLinkLog);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🔗 Guild Linked')
        .setColor('Green')
        .addFields(
          { name: 'Linked Guild ID', value: `\`${guildId}\``, inline: false },
          { name: 'Linked By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false }
        )
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] }).catch(console.error);
    }
  },
};