const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    // Only run if roles changed
    if (oldMember.roles.cache.size === newMember.roles.cache.size && 
        oldMember.roles.cache.every(role => newMember.roles.cache.has(role.id))) {
      return;
    }

    // Get configuration
    const syncConfig = config.RoleSync;
    if (!syncConfig || !syncConfig.enabled) return;

    const sourceGuildId = syncConfig.sourceGuildId;
    const targetGuildId = syncConfig.targetGuildId;
    const roleMappings = syncConfig.roleMappings; // { "sourceRoleId": "targetRoleId" }
    const logChannelId = syncConfig.logChannelId;

    // Determine which guild this event is from
    const isSourceGuild = newMember.guild.id === sourceGuildId;
    const isTargetGuild = newMember.guild.id === targetGuildId;

    if (!isSourceGuild && !isTargetGuild) return;

    // Get both guilds
    const sourceGuild = newMember.client.guilds.cache.get(sourceGuildId);
    const targetGuild = newMember.client.guilds.cache.get(targetGuildId);
    
    if (!sourceGuild || !targetGuild) {
      console.error('Could not find one or both guilds');
      return;
    }

    // Get the member in both guilds
    let sourceMember, targetMember;
    try {
      sourceMember = await sourceGuild.members.fetch(newMember.id);
      targetMember = await targetGuild.members.fetch(newMember.id);
    } catch (error) {
      // Member not in both guilds
      return;
    }

    // Detect added and removed roles
    const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    const changes = [];

    // Process removed roles - remove from BOTH guilds
    for (const [roleId, role] of removedRoles) {
      // Check if this role is in our mappings
      const isSourceRole = roleMappings[roleId];
      const isTargetRole = Object.keys(roleMappings).find(key => roleMappings[key] === roleId);
      
      if (isSourceRole) {
        // This is a source role, remove both source and target
        const targetRoleId = roleMappings[roleId];
        const targetRole = targetGuild.roles.cache.get(targetRoleId);
        
        // Remove from source guild if they have it
        if (sourceMember.roles.cache.has(roleId)) {
          try {
            await sourceMember.roles.remove(roleId);
            changes.push({
              action: 'removed',
              roleName: role.name,
              guildName: sourceGuild.name
            });
          } catch (error) {
            console.error(`Failed to remove role ${role.name} from source:`, error);
          }
        }
        
        // Remove from target guild if they have it
        if (targetRole && targetMember.roles.cache.has(targetRoleId)) {
          try {
            await targetMember.roles.remove(targetRole);
            changes.push({
              action: 'removed',
              roleName: targetRole.name,
              guildName: targetGuild.name
            });
          } catch (error) {
            console.error(`Failed to remove role ${targetRole.name} from target:`, error);
          }
        }
      } else if (isTargetRole) {
        // This is a target role, remove both target and source
        const sourceRoleId = isTargetRole;
        const sourceRole = sourceGuild.roles.cache.get(sourceRoleId);
        
        // Remove from target guild if they have it
        if (targetMember.roles.cache.has(roleId)) {
          try {
            await targetMember.roles.remove(roleId);
            changes.push({
              action: 'removed',
              roleName: role.name,
              guildName: targetGuild.name
            });
          } catch (error) {
            console.error(`Failed to remove role ${role.name} from target:`, error);
          }
        }
        
        // Remove from source guild if they have it
        if (sourceRole && sourceMember.roles.cache.has(sourceRoleId)) {
          try {
            await sourceMember.roles.remove(sourceRole);
            changes.push({
              action: 'removed',
              roleName: sourceRole.name,
              guildName: sourceGuild.name
            });
          } catch (error) {
            console.error(`Failed to remove role ${sourceRole.name} from source:`, error);
          }
        }
      }
    }

    // Process added roles - add to both guilds
    for (const [roleId, role] of addedRoles) {
      const isSourceRole = roleMappings[roleId];
      const isTargetRole = Object.keys(roleMappings).find(key => roleMappings[key] === roleId);
      
      if (isSourceRole) {
        // This is a source role, add to both
        const targetRoleId = roleMappings[roleId];
        const targetRole = targetGuild.roles.cache.get(targetRoleId);
        
        // Add to source guild if they don't have it
        if (!sourceMember.roles.cache.has(roleId)) {
          try {
            await sourceMember.roles.add(roleId);
            changes.push({
              action: 'added',
              roleName: role.name,
              guildName: sourceGuild.name
            });
          } catch (error) {
            console.error(`Failed to add role ${role.name} to source:`, error);
          }
        }
        
        // Add to target guild if they don't have it
        if (targetRole && !targetMember.roles.cache.has(targetRoleId)) {
          try {
            await targetMember.roles.add(targetRole);
            changes.push({
              action: 'added',
              roleName: targetRole.name,
              guildName: targetGuild.name
            });
          } catch (error) {
            console.error(`Failed to add role ${targetRole.name} to target:`, error);
          }
        }
      } else if (isTargetRole) {
        // This is a target role, add to both
        const sourceRoleId = isTargetRole;
        const sourceRole = sourceGuild.roles.cache.get(sourceRoleId);
        
        // Add to target guild if they don't have it
        if (!targetMember.roles.cache.has(roleId)) {
          try {
            await targetMember.roles.add(roleId);
            changes.push({
              action: 'added',
              roleName: role.name,
              guildName: targetGuild.name
            });
          } catch (error) {
            console.error(`Failed to add role ${role.name} to target:`, error);
          }
        }
        
        // Add to source guild if they don't have it
        if (sourceRole && !sourceMember.roles.cache.has(sourceRoleId)) {
          try {
            await sourceMember.roles.add(sourceRole);
            changes.push({
              action: 'added',
              roleName: sourceRole.name,
              guildName: sourceGuild.name
            });
          } catch (error) {
            console.error(`Failed to add role ${sourceRole.name} to source:`, error);
          }
        }
      }
    }

    // Log changes
    if (changes.length > 0 && logChannelId) {
      const logChannel = newMember.client.channels.cache.get(logChannelId);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🔄 Role Sync Update')
          .setColor('Blue')
          .addFields(
            { name: 'User', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: false }
          )
          .setTimestamp();

        for (const change of changes) {
          const emoji = change.action === 'added' ? '✅' : '❌';
          embed.addFields({
            name: `${emoji} ${change.action === 'added' ? 'Added' : 'Removed'}`,
            value: `**${change.roleName}** in ${change.guildName}`,
            inline: false
          });
        }

        logChannel.send({ embeds: [embed] }).catch(console.error);
      }
    }
  }
};