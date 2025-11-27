// Suppress dotenv messages
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('[dotenv@') || message.includes('injecting env')) {
    return;
  }
  originalLog.apply(console, args);
};

console.error = function(...args) {
  const message = args.join(' ');
  if (message.includes('[dotenv@') || message.includes('injecting env')) {
    return;
  }
  originalError.apply(console, args);
};

// Load environment variables
require('dotenv').config({ debug: false });

// Restore console functions after dotenv loads
setTimeout(() => {
  console.log = originalLog;
  console.error = originalError;
}, 100);

const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const config = require('./config.json');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Load commands
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    try {
      const command = require(filePath);

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        console.warn(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
      }
    } catch (error) {
      console.error(`❌ Error loading command ${filePath}:`, error);
    }
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  try {
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  } catch (error) {
    console.error(`❌ Error loading event ${filePath}:`, error);
  }
}

// DM Forwarding
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only handle DMs
  if (!message.guild) {
    const dmLogChannelId = config.Logging?.dmLogs;
    
    if (dmLogChannelId) {
      try {
        const dmLogChannel = await client.channels.fetch(dmLogChannelId).catch(() => null);
        
        if (dmLogChannel) {
          const embed = {
            color: 0x5865F2,
            author: {
              name: `DM from ${message.author.tag}`,
              iconURL: message.author.displayAvatarURL({ dynamic: true }),
            },
            description: message.content || '*No content*',
            timestamp: new Date().toISOString(),
            footer: {
              text: `User ID: ${message.author.id}`,
            },
          };

          // Add attachments if any
          if (message.attachments.size > 0) {
            embed.image = { url: message.attachments.first().url };
            embed.fields = [
              {
                name: 'Attachments',
                value: message.attachments.map(att => `[${att.name}](${att.url})`).join('\n'),
              },
            ];
          }

          await dmLogChannel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error('❌ Error forwarding DM:', error);
      }
    }
  }
});

// Login to Discord
client.login(process.env.TOKEN).catch((error) => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

