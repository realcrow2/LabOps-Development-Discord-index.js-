const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');

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
    .setName('setglobalrole')
    .setDescription('Set roles that can use globalban/unban commands')
    .addRoleOption(option => option.setName('role').setDescription('Role to add').setRequired(true)),

  async execute(interaction) {
    // Only allow server owner
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Only the server owner can use this command.', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    const globalRoles = loadJsonSafe('./GlobalRoles.json', {});

    const guildRoles = globalRoles[interaction.guildId] || [];

    if (!guildRoles.includes(role.id)) {
      guildRoles.push(role.id);
      globalRoles[interaction.guildId] = guildRoles;
      fs.writeFileSync('./GlobalRoles.json', JSON.stringify(globalRoles, null, 2));
      return interaction.reply({ content: `✅ Added ${role.name} to global moderator roles.`, ephemeral: true });
    } else {
      return interaction.reply({ content: `ℹ️ ${role.name} is already in the global moderator roles.`, ephemeral: true });
    }
  },
};