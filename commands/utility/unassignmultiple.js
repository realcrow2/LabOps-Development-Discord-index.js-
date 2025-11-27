const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unassignmultiple')
    .setDescription('Remove multiple roles from a user.')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to remove roles from').setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role1').setDescription('Role 1').setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role2').setDescription('Role 2').setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('role3').setDescription('Role 3').setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('role4').setDescription('Role 4').setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('role5').setDescription('Role 5').setRequired(false)
    ),

  async execute(interaction) {
    const approverRoleIds = config.RoleManagement.assignRole.allowedRoles || [];
    const logChannelId = config.RoleManagement.unassignRole.logChannel;

    // Check if user has any of the approver roles
    const hasPermission = approverRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
    
    if (!hasPermission) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id);

    // Collect all provided roles
    const roles = [];
    for (let i = 1; i <= 5; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) roles.push(role);
    }

    // Permission hierarchy check for all roles
    const invalidRoles = roles.filter(role => role.position >= interaction.member.roles.highest.position);
    if (invalidRoles.length > 0) {
      return interaction.reply({ 
        content: `❌ You cannot remove roles equal or higher than your highest role: ${invalidRoles.map(r => r.name).join(', ')}`, 
        ephemeral: true 
      });
    }

    // Defer the reply to prevent timeout
    await interaction.deferReply();

    // Remove all roles in parallel using Promise.allSettled
    const rolePromises = roles.map(role => 
      member.roles.remove(role)
        .then(() => ({ status: 'fulfilled', role }))
        .catch(err => ({ status: 'rejected', role, error: err }))
    );

    const results = await Promise.allSettled(rolePromises);

    const successfulRoles = [];
    const failedRoles = [];

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
        successfulRoles.push(result.value.role);
      } else {
        const roleData = result.value || result.reason;
        failedRoles.push(roleData.role);
        console.error('Failed to remove role:', roleData.error || result.reason);
      }
    });

    // Create public embed
    let description = '';
    if (successfulRoles.length > 0) {
      description += `❌ Removed roles: ${successfulRoles.map(r => `**${r.name}**`).join(', ')} from ${user}.\n`;
    }
    if (failedRoles.length > 0) {
      description += `⚠️ Failed to remove: ${failedRoles.map(r => `**${r.name}**`).join(', ')}.`;
    }

    const publicEmbed = new EmbedBuilder()
      .setColor(failedRoles.length > 0 ? 'Orange' : 'Red')
      .setDescription(description);

    await interaction.editReply({ embeds: [publicEmbed] });

    // Log to the channel
    if (successfulRoles.length > 0) {
      const logChannel = interaction.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Multiple Roles Removed')
          .setColor('Red')
          .addFields(
            { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: false },
            { name: 'Roles', value: successfulRoles.map(r => `${r.name} (${r.id})`).join('\n'), inline: false },
            { name: 'Removed By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
          )
          .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(console.error);
      }
    }
  }
};