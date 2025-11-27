const { SlashCommandBuilder } = require('@discordjs/builders');
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
    .setName('removeglobalrole')
    .setDescription('Remove a role from global mod permissions')
    .addRoleOption(option => option.setName('role').setDescription('Role to remove').setRequired(true)),

  async execute(interaction) {
    // Only allow server owner
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Only the server owner can use this command.', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    const globalRoles = loadJsonSafe('./GlobalRoles.json', {});

    if (!globalRoles[interaction.guildId] || !globalRoles[interaction.guildId].includes(role.id)) {
      return interaction.reply({ content: '⚠️ That role is not in the global mod list.', ephemeral: true });
    }

    globalRoles[interaction.guildId] = globalRoles[interaction.guildId].filter(id => id !== role.id);

    if (globalRoles[interaction.guildId].length === 0) {
      delete globalRoles[interaction.guildId];
    }

    fs.writeFileSync('./GlobalRoles.json', JSON.stringify(globalRoles, null, 2));
    return interaction.reply({ content: `🗑️ Removed ${role.name} from global moderator roles.`, ephemeral: true });
  }
};