const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`\n╔═══════════════════════════════════════╗`);
    console.log(`║     LabOps Development                ║`);
    console.log(`║     ✅ Bot is online and ready!        ║`);
    console.log(`║     Bot ID: ${client.user.id.padEnd(21)} ║`);
    console.log(`╚═══════════════════════════════════════╝\n`);

    // Load status display configuration
    const statusConfig = config.StatusDisplay || {};
    
    if (!statusConfig.enabled) {
      // Setup guildMemberAdd event for autorole only
      if (!client._autoRoleListenerAdded) {
        client._autoRoleListenerAdded = true;
        const autoRoleId = statusConfig.autoRoleId || config.Verification.verifyRoleId;
        
        client.on('guildMemberAdd', async (member) => {
          try {
            const role = member.guild.roles.cache.get(autoRoleId);
            if (role) {
              await member.roles.add(role);
              console.log(`✅ Auto role added to ${member.user.tag}`);
            }
          } catch (err) {
            console.error(`❌ Failed to add auto role to ${member.user.tag}:`, err);
          }
        });
      }
      return;
    }

    // Auto role configuration
    const AUTO_ROLE_ID = statusConfig.autoRoleId || config.Verification.verifyRoleId || "1443427809883066479";

    // Channels to send status to
    const statusChannels = statusConfig.statusChannels || [];

    // Neon colors
    const neonColors = statusConfig.neonColors || [
      0xFF00FF, // Magenta
      0x00FFFF, // Cyan
      0x39FF14, // Neon Green
      0xFFFF00, // Yellow
      0xFF3131, // Bright Red
      0xFF6EC7  // Neon Pink
    ];

    // Footer messages
    const footerMessages = statusConfig.footerMessages || [
      "All Systems Operational... Maybe ✔️",
      "Status checked ✔️",
      "Systems running better than my sleep schedule 😴",
      "Everything is under control... probably 👀",
      "! Core: Your favorite assistant 🗝️"
    ];

    // Build buttons from config
    const buttons = [];
    if (statusConfig.buttons) {
      // Button 1
      if (statusConfig.buttons.button1) {
        const btn1 = statusConfig.buttons.button1;
        const button1 = new ButtonBuilder()
          .setLabel(btn1.label);
        
        if (btn1.customId) button1.setCustomId(btn1.customId);
        if (btn1.style) button1.setStyle(ButtonStyle[btn1.style]);
        if (btn1.disabled !== undefined) button1.setDisabled(btn1.disabled);
        if (btn1.emoji) button1.setEmoji(btn1.emoji);
        if (btn1.url) button1.setURL(btn1.url);
        
        buttons.push(button1);
      }
      
      // Button 2
      if (statusConfig.buttons.button2) {
        const btn2 = statusConfig.buttons.button2;
        const button2 = new ButtonBuilder()
          .setLabel(btn2.label);
        
        if (btn2.customId) button2.setCustomId(btn2.customId);
        if (btn2.style) button2.setStyle(ButtonStyle[btn2.style]);
        if (btn2.disabled !== undefined) button2.setDisabled(btn2.disabled);
        if (btn2.emoji) button2.setEmoji(btn2.emoji);
        if (btn2.url) button2.setURL(btn2.url);
        
        buttons.push(button2);
      }
      
      // Button 3 - Dynamically generate invite URL with current bot ID
      if (statusConfig.buttons.button3) {
        const btn3 = statusConfig.buttons.button3;
        const button3 = new ButtonBuilder()
          .setLabel(btn3.label);
        
        if (btn3.customId) button3.setCustomId(btn3.customId);
        if (btn3.style) button3.setStyle(ButtonStyle[btn3.style]);
        if (btn3.disabled !== undefined) button3.setDisabled(btn3.disabled);
        if (btn3.emoji) button3.setEmoji(btn3.emoji);
        
        // Generate invite URL with current bot's client ID
        if (btn3.url) {
          const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&integration_type=0&scope=bot`;
          button3.setURL(inviteUrl);
        }
        
        buttons.push(button3);
      }
    }

    const row = buttons.length > 0 ? new ActionRowBuilder().addComponents(...buttons) : null;

    // Send to each channel
    for (const channelId of statusChannels) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) continue;

        // Delete all messages first
        let fetched;
        do {
          fetched = await channel.messages.fetch({ limit: 100 });
          if (fetched.size > 0) {
            await channel.bulkDelete(fetched, true).catch(() => {});
          }
        } while (fetched.size >= 2);

        // Build embed
        let colorIndex = 0;
        const startedAt = Math.floor(client.readyTimestamp / 1000);
        const embedTitle = statusConfig.embedTitle || 'Player Assistant Status';
        const embedDescription = statusConfig.embedDescription || '✅️ All Systems Operational';
        const embedImage = statusConfig.embedImage || null;
        const updateInterval = statusConfig.updateInterval || 10000;

        const embed = new EmbedBuilder()
          .setTitle(embedTitle)
          .setDescription(embedDescription)
          .setColor(neonColors[colorIndex])
          .addFields(
            { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
            { name: 'Total Members', value: `${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`, inline: true },
            { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
            { name: 'Uptime', value: `<t:${startedAt}:R>`, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: footerMessages[Math.floor(Math.random() * footerMessages.length)] });

        if (embedImage) embed.setImage(embedImage);

        // Send embed
        const messageOptions = { embeds: [embed] };
        if (row) messageOptions.components = [row];
        const message = await channel.send(messageOptions);

        // Start rotation updater
        setInterval(async () => {
          colorIndex = (colorIndex + 1) % neonColors.length;

          const updatedEmbed = new EmbedBuilder()
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .setColor(neonColors[colorIndex])
            .addFields(
              { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
              { name: 'Total Members', value: `${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`, inline: true },
              { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
              { name: 'Uptime', value: `<t:${startedAt}:R>`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: footerMessages[Math.floor(Math.random() * footerMessages.length)] });

          if (embedImage) updatedEmbed.setImage(embedImage);

          try {
            const updateOptions = { embeds: [updatedEmbed] };
            if (row) updateOptions.components = [row];
            await message.edit(updateOptions);
          } catch (err) {
            console.error("❌ Failed to edit status embed:", err);
          }
        }, updateInterval);

      } catch (err) {
        console.error(`❌ Failed to send status to channel ${channelId}:`, err);
      }
    }

    // Setup guildMemberAdd event for autorole (only once)
    if (!client._autoRoleListenerAdded) {
      client._autoRoleListenerAdded = true;
      
      client.on('guildMemberAdd', async (member) => {
        try {
          const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
          if (role) {
            await member.roles.add(role);
            console.log(`✅ Auto role added to ${member.user.tag}`);
          } else {
            console.error(`❌ Auto role ${AUTO_ROLE_ID} not found in ${member.guild.name}`);
          }
        } catch (err) {
          console.error(`❌ Failed to add auto role to ${member.user.tag}:`, err);
        }
      });
    }
  }
};