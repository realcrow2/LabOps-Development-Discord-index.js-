const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config(); // load .env

function loadJsonSafe(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearallglobalroles')
    .setDescription('Remove all global mod roles for every server'),

  async execute(interaction) {
    const botOwnerId = process.env.OWNER_ID || "1228084539138506845"; // fallback to your ID

    if (interaction.user.id !== botOwnerId) {
      return interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
    }

    const globalRoles = loadJsonSafe('./GlobalRoles.json', {});

    if (Object.keys(globalRoles).length === 0) {
      return interaction.reply({ content: '⚠️ No global mod roles found to clear.', ephemeral: true });
    }

    fs.writeFileSync('./GlobalRoles.json', JSON.stringify({}, null, 2));

    return interaction.reply({ content: '🧹 All global mod roles have been cleared for every server.', ephemeral: true });
  }
};