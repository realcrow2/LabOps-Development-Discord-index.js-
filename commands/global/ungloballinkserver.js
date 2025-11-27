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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ungloballink')
    .setDescription('Unlink a guild and leave it')
    .addStringOption(option => option.setName('guildid').setDescription('Guild ID to unlink').setRequired(true)),

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

    if (!linkedGuilds.includes(guildId)) {
      return interaction.reply({ content: 'ℹ️ This guild is not linked.', ephemeral: true });
    }

    const updated = linkedGuilds.filter(id => id !== guildId);
    fs.writeFileSync('./Guild_Linked.json', JSON.stringify(updated, null, 2));

    await interaction.reply({ content: `❌ Guild \`${guildId}\` has been unlinked and will be left if the bot is still in it.`, ephemeral: true });

    // Use the dedicated GlobalLink_log channel instead of logChannelId
    const logChannel = interaction.client.channels.cache.get(config.Logging.globalLinkLog);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🚫 Guild Unlinked')
        .setColor('Red')
        .addFields(
          { name: 'Unlinked Guild ID', value: `\`${guildId}\``, inline: false },
          { name: 'Unlinked By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false }
        )
        .setTimestamp();
      logChannel.send({ embeds: [logEmbed] }).catch(console.error);
    }

    // Leave the guild if bot is still in it
    const targetGuild = interaction.client.guilds.cache.get(guildId);
    if (targetGuild) {
      await targetGuild.leave().catch(console.error);
    }
  },
};