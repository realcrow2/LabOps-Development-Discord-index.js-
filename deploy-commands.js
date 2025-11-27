require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    try {
      const command = require(filePath);

      if (!command || !command.data || typeof command.data.toJSON !== 'function') {
        console.warn(`⚠️ Skipping invalid command: ${folder}/${file} (missing or bad .data.toJSON)`);
        continue;
      }

      commands.push(command.data.toJSON());
    } catch (err) {
      console.error(`❌ Error loading command file: ${folder}/${file}`);
      console.error(err);
    }
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`⏳ Registering slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log('✅ Successfully registered commands globally!');
  } catch (error) {
    console.error('❌ Failed to register commands:');
    console.error(error);
  }
})();