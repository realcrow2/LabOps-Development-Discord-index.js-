// commands/global/apirestore.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load config
const config = require(path.join(__dirname, '../../config.json'));

// Role backup storage file
const BACKUP_FILE = path.join(__dirname, '../../role_backups.json');

// Helper functions
function loadBackups() {
    try {
        if (fs.existsSync(BACKUP_FILE)) {
            const data = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
            return new Map(Object.entries(data));
        }
    } catch (error) {
        console.error('Error loading backups:', error);
    }
    return new Map();
}

function saveBackups(backups) {
    try {
        const data = Object.fromEntries(backups);
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving backups:', error);
    }
}

async function sendLog(guild, embed) {
    try {
        const logChannel = await guild.channels.fetch(config.RoleRestore.logChannel);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error sending log:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('api')
        .setDescription('API commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restore roles for a previously kicked/banned user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to restore roles for')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'restore') {
            // Check if user has the required role
            const hasRole = interaction.member.roles.cache.has(config.RoleRestore.requiredRole);
            
            if (!hasRole) {
                return interaction.reply({
                    content: '❌ You do not have the required role to use this command.',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const backupKey = `${interaction.guild.id}-${targetUser.id}`;

            // Load backups
            const roleBackups = loadBackups();

            // Check if backup exists
            if (!roleBackups.has(backupKey)) {
                return interaction.reply({
                    content: `❌ No role backup found for **${targetUser.tag}**. Backups expire after 24 hours.`,
                    ephemeral: true
                });
            }

            await interaction.deferReply();

            try {
                const backup = roleBackups.get(backupKey);
                
                // Check if backup is still valid (24 hours)
                const twentyFourHours = 24 * 60 * 60 * 1000;
                if (Date.now() - backup.timestamp > twentyFourHours) {
                    roleBackups.delete(backupKey);
                    saveBackups(roleBackups);
                    return interaction.editReply({
                        content: `❌ The role backup for **${targetUser.tag}** has expired.`
                    });
                }

                // Get the member
                const member = await interaction.guild.members.fetch(targetUser.id);
                
                // Filter roles that still exist
                const validRoles = [];
                const invalidRoles = [];
                
                for (const roleId of backup.roles) {
                    try {
                        const role = await interaction.guild.roles.fetch(roleId);
                        if (role) {
                            validRoles.push(role);
                        } else {
                            invalidRoles.push(roleId);
                        }
                    } catch {
                        invalidRoles.push(roleId);
                    }
                }

                // Add roles back
                if (validRoles.length > 0) {
                    await member.roles.add(validRoles);
                }

                // Remove backup after successful restore
                roleBackups.delete(backupKey);
                saveBackups(roleBackups);

                // Create success embed
                const successEmbed = new EmbedBuilder()
                    .setColor('#51CF66')
                    .setTitle('✅ Roles Restored')
                    .setDescription(`Successfully restored roles for **${targetUser.tag}**`)
                    .addFields(
                        { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                        { name: 'Roles Restored', value: `${validRoles.length}`, inline: true },
                        { name: 'Restored By', value: `${interaction.user.tag}`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Role Restore System' });

                if (validRoles.length > 0) {
                    successEmbed.addFields({
                        name: 'Restored Roles',
                        value: validRoles.map(r => `<@&${r.id}>`).join(', ')
                    });
                }

                if (invalidRoles.length > 0) {
                    successEmbed.addFields({
                        name: '⚠️ Roles Not Found',
                        value: `${invalidRoles.length} role(s) no longer exist in the server`
                    });
                }

                await interaction.editReply({ embeds: [successEmbed] });
                await sendLog(interaction.guild, successEmbed);

            } catch (error) {
                console.error('Error restoring roles:', error);
                await interaction.editReply({
                    content: `❌ An error occurred while restoring roles: ${error.message}`
                });
            }
        }
    },
};