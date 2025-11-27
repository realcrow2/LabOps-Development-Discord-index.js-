const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlinkpermission')
    .setDescription('Set who can use link/unlink commands (Owner only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('Add a user who can use link commands')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to allow')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Add a role that can use link commands')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to allow')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('removeuser')
        .setDescription('Remove a user from link permissions')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('User to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('removerole')
        .setDescription('Remove a role from link permissions')
        .addRoleOption(option =>
          option.setName('role')
            .setDescription('Role to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all users and roles with link permissions')
    ),

  async execute(interaction) {
    // Only server owner can use this
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ 
        content: '❌ Only the server owner can use this command.', 
        ephemeral: true 
      });
    }

    const permissions = loadJsonSafe('./Link_Permissions.json', { allowedUsers: [], allowedRoles: {} });
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'user') {
      const user = interaction.options.getUser('user');
      
      if (permissions.allowedUsers.includes(user.id)) {
        return interaction.reply({ 
          content: `ℹ️ ${user.tag} already has link permissions.`, 
          ephemeral: true 
        });
      }

      permissions.allowedUsers.push(user.id);
      saveJsonSafe('./Link_Permissions.json', permissions);

      return interaction.reply({ 
        content: `✅ Added ${user.tag} to link permissions.`, 
        ephemeral: true 
      });
    }

    if (subcommand === 'role') {
      const role = interaction.options.getRole('role');
      const guildRoles = permissions.allowedRoles[interaction.guildId] || [];

      if (guildRoles.includes(role.id)) {
        return interaction.reply({ 
          content: `ℹ️ ${role.name} already has link permissions.`, 
          ephemeral: true 
        });
      }

      guildRoles.push(role.id);
      permissions.allowedRoles[interaction.guildId] = guildRoles;
      saveJsonSafe('./Link_Permissions.json', permissions);

      return interaction.reply({ 
        content: `✅ Added ${role.name} to link permissions.`, 
        ephemeral: true 
      });
    }

    if (subcommand === 'removeuser') {
      const user = interaction.options.getUser('user');
      
      if (!permissions.allowedUsers.includes(user.id)) {
        return interaction.reply({ 
          content: `ℹ️ ${user.tag} does not have link permissions.`, 
          ephemeral: true 
        });
      }

      permissions.allowedUsers = permissions.allowedUsers.filter(id => id !== user.id);
      saveJsonSafe('./Link_Permissions.json', permissions);

      return interaction.reply({ 
        content: `✅ Removed ${user.tag} from link permissions.`, 
        ephemeral: true 
      });
    }

    if (subcommand === 'removerole') {
      const role = interaction.options.getRole('role');
      const guildRoles = permissions.allowedRoles[interaction.guildId] || [];

      if (!guildRoles.includes(role.id)) {
        return interaction.reply({ 
          content: `ℹ️ ${role.name} does not have link permissions.`, 
          ephemeral: true 
        });
      }

      permissions.allowedRoles[interaction.guildId] = guildRoles.filter(id => id !== role.id);
      if (permissions.allowedRoles[interaction.guildId].length === 0) {
        delete permissions.allowedRoles[interaction.guildId];
      }
      saveJsonSafe('./Link_Permissions.json', permissions);

      return interaction.reply({ 
        content: `✅ Removed ${role.name} from link permissions.`, 
        ephemeral: true 
      });
    }

    if (subcommand === 'list') {
      const userList = [];
      for (const userId of permissions.allowedUsers) {
        try {
          const user = await interaction.client.users.fetch(userId);
          userList.push(`${user.tag} (${userId})`);
        } catch {
          userList.push(`Unknown (${userId})`);
        }
      }

      const roleList = [];
      const guildRoles = permissions.allowedRoles[interaction.guildId] || [];
      for (const roleId of guildRoles) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          roleList.push(`${role.name} (${roleId})`);
        } else {
          roleList.push(`Unknown (${roleId})`);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🔗 Link Permissions')
        .setColor('Blue')
        .addFields(
          { 
            name: '👤 Allowed Users', 
            value: userList.length > 0 ? userList.join('\n') : 'None',
            inline: false 
          },
          { 
            name: '🎭 Allowed Roles', 
            value: roleList.length > 0 ? roleList.join('\n') : 'None',
            inline: false 
          }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

