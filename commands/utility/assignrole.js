const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assignrole')
    .setDescription('Assign a role to a user.')
    .addUserOption(option =>
      option.setName('user').setDescription('The user to assign the role to').setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role').setDescription('The role to assign').setRequired(true)
    ),

  async execute(interaction) {
    const approverRoleIds = config.RoleManagement.assignRole.allowedRoles || [];
    const logChannelId = config.RoleManagement.assignRole.logChannel;

    // Check if user has any of the approver roles
    const hasPermission = approverRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
    
    if (!hasPermission) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const member = await interaction.guild.members.fetch(user.id);

    // Permission hierarchy check
    if (role.position >= interaction.member.roles.highest.position) {
      return interaction.reply({ content: '❌ You cannot assign a role equal or higher than your highest role.', ephemeral: true });
    }

    await member.roles.add(role).catch(err => {
      console.error(err);
      return interaction.reply({ content: '❌ Failed to assign the role.', ephemeral: true });
    });

    // ✅ Create the public embed
    const publicEmbed = new EmbedBuilder()
      .setColor('Green')
      .setDescription(`✅ Added role **${role.name}** to ${user}.`);

    await interaction.reply({ embeds: [publicEmbed] }); // Public reply

    // Log to the channel
    const logChannel = interaction.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Role Assigned')
        .setColor('Green')
        .addFields(
          { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: false },
          { name: 'Role', value: `${role.name} (${role.id})`, inline: false },
          { name: 'Assigned By', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
        )
        .setTimestamp();

      logChannel.send({ embeds: [embed] }).catch(console.error);
    }
  }
};