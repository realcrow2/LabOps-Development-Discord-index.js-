const path = require('path');
const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

function loadJsonSafe(filePath, fallbackValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallbackValue;
  }
}

function saveJsonSafe(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function removePendingAction(messageId) {
  const pending = loadJsonSafe('./Pending_Bans.json', {});
  delete pending[messageId];
  saveJsonSafe('./Pending_Bans.json', pending);
}

function loadRoleRequestConfig() {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'roleRequests.json');
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return {};
  }
}

function loadConfig() {
  try {
    return require(path.join(process.cwd(), 'config.json'));
  } catch {
    return {};
  }
}

function userHasGlobalRole(member, guildId) {
  const globalRoles = loadJsonSafe('./GlobalRoles.json', {});
  const allowedRoles = globalRoles[guildId] || [];
  return member.roles.cache.some(role => allowedRoles.includes(role.id));
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // Slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
      }

      // Buttons
      if (interaction.isButton()) {
        console.log(`🟢 Button clicked: ${interaction.customId}`);

        const [action] = interaction.customId.split('_');

        // === Role Request Approve Button ===
        if (interaction.customId.startsWith('approvereq_')) {
          const config = loadRoleRequestConfig();
          const guildConfig = config[interaction.guild.id];

          if (!guildConfig) {
            return interaction.reply({
              content: '❌ Role request system not configured for this server.',
              flags: 64
            });
          }

          const member = await interaction.guild.members.fetch(interaction.user.id);

          // Check if user has approver role permissions
          if (!guildConfig.approverRoles.some(r => member.roles.cache.has(r))) {
            return interaction.reply({
              content: '❌ You are not authorized to approve/deny role requests.',
              flags: 64
            });
          }

          const [, roleId, requesterId] = interaction.customId.split('_');
          const targetMember = await interaction.guild.members.fetch(requesterId).catch(() => null);
          
          if (!targetMember) {
            return interaction.reply({
              content: '❌ The requester is no longer in the server.',
              flags: 64
            });
          }

          const requestedRole = interaction.guild.roles.cache.get(roleId);
          if (!requestedRole) {
            return interaction.reply({
              content: '❌ The requested role no longer exists.',
              flags: 64
            });
          }

          // ⚠️ HIERARCHY CHECK - Prevent approving roles higher than the approver's highest role
          const approverHighestRole = member.roles.highest;
          
          if (requestedRole.position >= approverHighestRole.position) {
            return interaction.reply({
              content: `❌ You cannot approve this role. **${requestedRole.name}** (position: ${requestedRole.position}) is higher than or equal to your highest role **${approverHighestRole.name}** (position: ${approverHighestRole.position}).`,
              flags: 64
            });
          }

          // Also check bot's role hierarchy
          const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
          if (requestedRole.position >= botMember.roles.highest.position) {
            return interaction.reply({
              content: `❌ The bot cannot assign this role. **${requestedRole.name}** is higher than the bot's highest role.`,
              flags: 64
            });
          }

          // Defer the update
          try {
            await interaction.deferUpdate();
          } catch (error) {
            if (error.code === 10062) {
              console.log(`⚠️ Interaction expired for button: ${interaction.customId}`);
              return;
            }
            throw error;
          }

          // Add the role
          try {
            await targetMember.roles.add(requestedRole);
          } catch (err) {
            return interaction.followUp({
              content: `❌ Failed to add role: ${err.message}`,
              flags: 64
            });
          }

          // Update buttons
          const updatedButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('approved_role')
              .setLabel(`Approved By: ${interaction.user.username}`)
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('deny_role')
              .setLabel('Deny Role Request')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );

          await interaction.message.edit({ components: [updatedButtons] });

          // Get the original embed to extract requester info
          const originalEmbed = interaction.message.embeds[0];
          const requesterField = originalEmbed.fields.find(f => f.name === 'Requester');
          const approvedByField = originalEmbed.fields.find(f => f.name === 'Approved By');
          const noteField = originalEmbed.fields.find(f => f.name === 'Note');

          // Log the approval to config-based channel
          const mainConfig = loadConfig();
          const logChannelId = mainConfig.RoleManagement?.roleRequest?.logChannel;
          
          if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
              const logEmbed = new EmbedBuilder()
                .setTitle('✅ Role Request Approved')
                .setColor('Green')
                .addFields(
                  { name: 'Requester', value: requesterField?.value || `<@${requesterId}>`, inline: true },
                  { name: 'Requested By (Approved By)', value: approvedByField?.value || 'Unknown', inline: true },
                  { name: 'Actual Approver', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                  { name: 'Role Granted', value: `${requestedRole} (${requestedRole.name})`, inline: true },
                  { name: 'Role Position', value: `${requestedRole.position}`, inline: true },
                  { name: 'Approver Highest Role', value: `${approverHighestRole.name} (Position: ${approverHighestRole.position})`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `User ID: ${requesterId} | Role ID: ${roleId}` });

              if (noteField) {
                logEmbed.addFields({ name: 'Note', value: noteField.value, inline: false });
              }

              await logChannel.send({ embeds: [logEmbed] });
            }
          }

          return;
        }

        // === Role Request Deny Button ===
        if (interaction.customId.startsWith('denyreq_')) {
          const config = loadRoleRequestConfig();
          const guildConfig = config[interaction.guild.id];

          if (!guildConfig) {
            return interaction.reply({
              content: '❌ Role request system not configured for this server.',
              flags: 64
            });
          }

          const member = await interaction.guild.members.fetch(interaction.user.id);

          // Check permissions - anyone with approver role can deny regardless of hierarchy
          if (!guildConfig.approverRoles.some(r => member.roles.cache.has(r))) {
            return interaction.reply({
              content: '❌ You are not authorized to approve/deny role requests.',
              flags: 64
            });
          }

          const [, roleId, requesterId] = interaction.customId.split('_');
          const targetMember = await interaction.guild.members.fetch(requesterId).catch(() => null);
          
          if (!targetMember) {
            return interaction.reply({
              content: '❌ The requester is no longer in the server.',
              flags: 64
            });
          }

          const requestedRole = interaction.guild.roles.cache.get(roleId);
          if (!requestedRole) {
            return interaction.reply({
              content: '❌ The requested role no longer exists.',
              flags: 64
            });
          }

          // Defer the update
          try {
            await interaction.deferUpdate();
          } catch (error) {
            if (error.code === 10062) {
              console.log(`⚠️ Interaction expired for button: ${interaction.customId}`);
              return;
            }
            throw error;
          }

          // Update buttons
          const updatedButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('approve_role')
              .setLabel('Approve Role Request')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('denied_role')
              .setLabel(`Denied By: ${interaction.user.username}`)
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          );

          await interaction.message.edit({ components: [updatedButtons] });

          // Get the original embed to extract requester info
          const originalEmbed = interaction.message.embeds[0];
          const requesterField = originalEmbed.fields.find(f => f.name === 'Requester');
          const approvedByField = originalEmbed.fields.find(f => f.name === 'Approved By');
          const noteField = originalEmbed.fields.find(f => f.name === 'Note');
          const approverHighestRole = member.roles.highest;

          // Log the denial to config-based channel
          const mainConfig = loadConfig();
          const logChannelId = mainConfig.RoleManagement?.roleRequest?.logChannel;
          
          if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
              const logEmbed = new EmbedBuilder()
                .setTitle('❌ Role Request Denied')
                .setColor('Red')
                .addFields(
                  { name: 'Requester', value: requesterField?.value || `<@${requesterId}>`, inline: true },
                  { name: 'Requested By (To Approve)', value: approvedByField?.value || 'Unknown', inline: true },
                  { name: 'Denied By', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
                  { name: 'Requested Role', value: `${requestedRole} (${requestedRole.name})`, inline: true },
                  { name: 'Role Position', value: `${requestedRole.position}`, inline: true },
                  { name: 'Denier Highest Role', value: `${approverHighestRole.name} (Position: ${approverHighestRole.position})`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `User ID: ${requesterId} | Role ID: ${roleId}` });

              if (noteField) {
                logEmbed.addFields({ name: 'Note', value: noteField.value, inline: false });
              }

              await logChannel.send({ embeds: [logEmbed] });
            }
          }

          return;
        }

        // === Global Ban Approve Button ===
        if (interaction.customId.startsWith('approve_')) {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          
          // Check if user has global role permission
          if (!userHasGlobalRole(member, interaction.guild.id)) {
            return interaction.reply({ 
              content: '❌ You do not have permission to approve global bans. You need a global moderator role set by `/setglobalrole`.', 
              flags: 64 
            });
          }

          const userId = interaction.customId.split('_')[1];
          const approver = interaction.user;

          const newButtons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`approved_${userId}`)
                .setLabel(`Approved By: ${approver.username}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(`revoke_${userId}`)
                .setLabel('❌ Revoke')
                .setStyle(ButtonStyle.Danger)
            );

          try {
            await interaction.update({ components: [newButtons] });
          } catch (error) {
            if (error.code === 10062) {
              console.log(`⚠️ Interaction expired for button: ${interaction.customId}`);
              try {
                await interaction.message.edit({ components: [newButtons] });
              } catch (editError) {
                console.log('Could not update message for expired interaction');
              }
            } else {
              throw error;
            }
          }
          return;
        }

        // === Global Ban Revoke Button ===
        if (interaction.customId.startsWith('revoke_')) {
          const member = await interaction.guild.members.fetch(interaction.user.id);
          
          // Check if user has global role permission
          if (!userHasGlobalRole(member, interaction.guild.id)) {
            return interaction.reply({ 
              content: '❌ You do not have permission to revoke global bans. You need a global moderator role set by `/setglobalrole`.', 
              flags: 64 
            });
          }

          const userId = interaction.customId.split('_')[1];
          const revoker = interaction.user;
          const linkedGuilds = loadJsonSafe('./Guild_Linked.json', []);
          let banData = loadJsonSafe('./Ban_File.json', []);

          // Migrate old object format to array format
          if (!Array.isArray(banData)) {
            banData = [];
          }

          if (!banData.includes(userId)) {
            return interaction.reply({ 
              content: '⚠️ User is not globally banned.', 
              flags: 64 
            });
          }

          // Remove user from ban list
          const index = banData.indexOf(userId);
          banData.splice(index, 1);
          saveJsonSafe('./Ban_File.json', banData);

          const failedUnbans = [];
          const successUnbans = [];

          for (const guildId of linkedGuilds) {
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (!guild) continue;

            try {
              await guild.bans.remove(userId, `Global unban (revoke) by ${revoker.tag}`);
              successUnbans.push(guild.name || guildId);
            } catch (e) {
              if (!e.message.includes('Unknown Ban')) {
                failedUnbans.push(guild.name || guildId);
              }
            }
          }

          const newButtons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`revoked_${userId}`)
                .setLabel(`Revoked By: ${revoker.username}`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
            );

          try {
            await interaction.update({ components: [newButtons] });
          } catch (error) {
            if (error.code === 10062) {
              console.log(`⚠️ Interaction expired for revoke button: ${interaction.customId}`);
              
              try {
                await interaction.message.edit({ components: [newButtons] });
                console.log('✅ Successfully updated message despite expired interaction');
              } catch (editError) {
                console.log('⚠️ Could not update message for expired interaction');
              }
              
              removePendingAction(interaction.message.id);
              console.log(`✅ Global ban revoked for user ${userId} despite expired interaction`);
              return;
            }
            throw error;
          }
          
          removePendingAction(interaction.message.id);
          
          await interaction.followUp({ 
            content: `✅ Global ban revoked and user unbanned from ${successUnbans.length} server(s).${failedUnbans.length ? `\n⚠️ Failed unbans: ${failedUnbans.join(', ')}` : ''}`, 
            flags: 64
          });
          return;
        }

        // === Already Approved/Revoked (disabled state) ===
        if (interaction.customId.startsWith('approved_') || interaction.customId.startsWith('revoked_')) {
          return interaction.reply({ content: 'This action has already been processed.', flags: 64 });
        }

        // === Alt Checker Approve Button ===
        if (interaction.customId.startsWith('altapprove_')) {
          const config = loadConfig();
          const member = await interaction.guild.members.fetch(interaction.user.id);

          // Check if user has permission to approve
          const approverRoles = config.AltChecker?.approverRoles || [];
          const hasPermission = approverRoles.some(roleId => member.roles.cache.has(roleId));

          if (!hasPermission) {
            return interaction.reply({
              content: '❌ You do not have permission to approve/deny alt checks.',
              flags: 64
            });
          }

          const userId = interaction.customId.split('_')[1];
          const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

          if (!targetMember) {
            return interaction.reply({
              content: '❌ User is no longer in the server.',
              flags: 64
            });
          }

          // Update buttons to show approved
          const disabledButtons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`altapproved_${userId}`)
                .setLabel(`✅ Approved by ${interaction.user.username}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(`altdeny_disabled`)
                .setLabel('❌ Deny')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
            );

          try {
            await interaction.update({ components: [disabledButtons] });
          } catch (error) {
            if (error.code === 10062) {
              await interaction.message.edit({ components: [disabledButtons] });
            } else {
              throw error;
            }
          }

          // Remove from pending
          const pendingAltChecks = loadJsonSafe('./Pending_Alt_Checks.json', {});
          delete pendingAltChecks[userId];
          saveJsonSafe('./Pending_Alt_Checks.json', pendingAltChecks);

          await interaction.followUp({
            content: `✅ ${targetMember.user.tag} has been approved and can access the server normally.`,
            flags: 64
          });

          console.log(`✅ Alt check approved for ${targetMember.user.tag} by ${interaction.user.tag}`);
          return;
        }

        // === Alt Checker Deny Button ===
        if (interaction.customId.startsWith('altdeny_')) {
          const config = loadConfig();
          const member = await interaction.guild.members.fetch(interaction.user.id);

          // Check if user has permission to deny
          const approverRoles = config.AltChecker?.approverRoles || [];
          const hasPermission = approverRoles.some(roleId => member.roles.cache.has(roleId));

          if (!hasPermission) {
            return interaction.reply({
              content: '❌ You do not have permission to approve/deny alt checks.',
              flags: 64
            });
          }

          const userId = interaction.customId.split('_')[1];
          const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

          if (!targetMember) {
            return interaction.reply({
              content: '❌ User is no longer in the server.',
              flags: 64
            });
          }

          const deniedRoleId = config.AltChecker?.deniedRole;
          if (!deniedRoleId) {
            return interaction.reply({
              content: '❌ Denied role is not configured in config.json',
              flags: 64
            });
          }

          const deniedRole = interaction.guild.roles.cache.get(deniedRoleId);
          if (!deniedRole) {
            return interaction.reply({
              content: '❌ Denied role not found in server.',
              flags: 64
            });
          }

          // Remove all roles from target member (except @everyone)
          const rolesToRemove = targetMember.roles.cache.filter(role => role.id !== interaction.guild.id);
          
          try {
            await targetMember.roles.remove(rolesToRemove);
            await targetMember.roles.add(deniedRole);
          } catch (error) {
            return interaction.reply({
              content: `❌ Failed to update roles: ${error.message}`,
              flags: 64
            });
          }

          // Update buttons to show denied
          const disabledButtons = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`altapprove_disabled`)
                .setLabel('✅ Approve')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId(`altdenied_${userId}`)
                .setLabel(`❌ Denied by ${interaction.user.username}`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
            );

          try {
            await interaction.update({ components: [disabledButtons] });
          } catch (error) {
            if (error.code === 10062) {
              await interaction.message.edit({ components: [disabledButtons] });
            } else {
              throw error;
            }
          }

          // Remove from pending
          const pendingAltChecks = loadJsonSafe('./Pending_Alt_Checks.json', {});
          delete pendingAltChecks[userId];
          saveJsonSafe('./Pending_Alt_Checks.json', pendingAltChecks);

          await interaction.followUp({
            content: `✅ ${targetMember.user.tag} has been denied. All roles removed and denied role assigned.`,
            flags: 64
          });

          console.log(`❌ Alt check denied for ${targetMember.user.tag} by ${interaction.user.tag}`);
          return;
        }

        // === Verify button - removes AUTO_ROLE_ID ===
        if (interaction.customId === 'verify_button') {
          const member = interaction.member;
          const config = loadConfig();
          const statusConfig = config.StatusDisplay || {};
          const autoRoleId = statusConfig.autoRoleId || config.Verification?.verifyRoleId || "1443427809883066479";
          const autoRole = interaction.guild.roles.cache.get(autoRoleId);

          let verifyRoleId = config.Verification?.verifyRoleId || null;

          if (autoRole && member.roles.cache.has(autoRoleId)) {
            try {
              await member.roles.remove(autoRole);
              
              if (verifyRoleId) {
                const verifyRole = interaction.guild.roles.cache.get(verifyRoleId);
                if (verifyRole) {
                  await member.roles.add(verifyRole);
                }
              }

              await interaction.reply({ 
                content: '🎉 You have been verified! The unverified role has been removed.', 
                flags: 64
              });
              console.log(`✅ Auto role removed from ${member.user.tag} after verification`);
            } catch (error) {
              console.error('Error during verification:', error);
              await interaction.reply({ 
                content: '❌ Failed to verify. Please contact an admin.', 
                flags: 64
              });
            }
          } else {
            await interaction.reply({ 
              content: '✅ You are already verified!', 
              flags: 64
            });
          }
        }

      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: '❌ Something went wrong.', flags: 64 });
        } catch {}
      }
    }
  },
};