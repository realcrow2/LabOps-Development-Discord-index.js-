const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(process.cwd(), 'dmForwardConfig.json');
let dmForwardConfig = {};
if (fs.existsSync(configPath)) {
  dmForwardConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setdmforward')
    .setDescription('Set the channel where all bot DMs will be forwarded')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to forward DMs into')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    dmForwardConfig[interaction.guild.id] = {
      channelId: channel.id
    };
    fs.writeFileSync(configPath, JSON.stringify(dmForwardConfig, null, 2));

    await interaction.reply({ content: `✅ DM forwarding channel set to ${channel}`, ephemeral: true });
  },

  // This runs when bot starts, attaches DM listener ONCE
  init(client) {
    client.once('ready', () => {
      client.on('messageCreate', async message => {
        if (message.guild || message.author.bot) return;

        for (const guildId in dmForwardConfig) {
          const { channelId } = dmForwardConfig[guildId];
          const guild = client.guilds.cache.get(guildId);
          if (!guild) continue;

          const forwardChannel = guild.channels.cache.get(channelId);
          if (!forwardChannel) continue;

          const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(message.content || "*[No text — maybe an attachment?]*")
            .setFooter({ text: `User ID: ${message.author.id}` })
            .setTimestamp();

          await forwardChannel.send({ embeds: [embed] });

          if (message.attachments.size > 0) {
            await forwardChannel.send({ files: message.attachments.map(a => a.url) });
          }
        }
      });
    });
  }
};