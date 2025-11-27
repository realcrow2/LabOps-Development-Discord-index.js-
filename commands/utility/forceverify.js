const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forceverify')
        .setDescription('Manually verify a user and give them the verified role')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to verify')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Role IDs
        const VERIFIED_ROLE_ID = '1435320651278716968';
        const UNVERIFIED_ROLE_ID = '1435320653052903456';
        const ADMIN_ROLE_ID = '1435320547918614719';
        const LOG_CHANNEL_ID = '1438654638344769596';

        try {
            // Check if user has the required role
            if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
                return interaction.reply({
                    content: '❌ You do not have permission to use this command!',
                    ephemeral: true
                });
            }

            const targetUser = interaction.options.getUser('user');
            const targetMember = interaction.guild.members.cache.get(targetUser.id);

            if (!targetMember) {
                return interaction.reply({
                    content: '❌ Could not find that user in this server!',
                    ephemeral: true
                });
            }

            // Check if user already has the role
            if (targetMember.roles.cache.has(VERIFIED_ROLE_ID)) {
                return interaction.reply({
                    content: `❌ ${targetUser.tag} is already verified!`,
                    ephemeral: true
                });
            }

            // Defer the reply to give us more time
            await interaction.deferReply();

            let removedUnverified = false;

            // Remove unverified role if they have it
            if (targetMember.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                try {
                    await targetMember.roles.remove(UNVERIFIED_ROLE_ID);
                    removedUnverified = true;
                    console.log(`✅ Removed unverified role from ${targetUser.tag}`);
                    // Small delay to prevent rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (roleError) {
                    console.error(`❌ Failed to remove unverified role: ${roleError.message}`);
                }
            } else {
                console.log(`⚠️ User ${targetUser.tag} does not have the unverified role`);
            }
            
            // Add the verified role
            await targetMember.roles.add(VERIFIED_ROLE_ID);
            console.log(`✅ Added verified role to ${targetUser.tag}`);

            // Send DM to the verified user (don't let this fail the whole command)
            const dmEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('<a:Rocket:1438664545924026398> You Have Been Verified!')
                .setDescription(`You have been manually verified in **${interaction.guild.name}**`)
                .addFields(
                    { name: 'Verified By', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setThumbnail(interaction.guild.iconURL())
                .setTimestamp()
                .setFooter({ text: interaction.guild.name });

            try {
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.log(`Could not DM ${targetUser.tag}: ${dmError.message}`);
            }

            // Send log to log channel (don't let this fail the whole command)
            try {
                const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🔍 Force Verify Log')
                        .setDescription(`A user has been manually verified`)
                        .addFields(
                            { name: 'User Verified', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                            { name: 'Verified By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                            { name: 'Role Added', value: `<@&${VERIFIED_ROLE_ID}>`, inline: true },
                            { name: 'Role Removed', value: `<@&${UNVERIFIED_ROLE_ID}>`, inline: true },
                            { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                        )
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setTimestamp()
                        .setFooter({ text: `Executed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

                    await logChannel.send({ embeds: [logEmbed] });
                }
            } catch (logError) {
                console.error('Error sending log:', logError.message);
            }

            // Reply to the command executor
            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ User Verified Successfully')
                .setDescription(`${targetUser.tag} has been verified!`)
                .addFields(
                    { name: 'User', value: `${targetUser.tag}`, inline: true },
                    { name: 'Role Added', value: `<@&${VERIFIED_ROLE_ID}>`, inline: true },
                    { name: 'Unverified Role Removed', value: removedUnverified ? '✅ Yes' : '⚠️ Not Found', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error executing forceverify command:', error);
            
            // Determine the appropriate way to respond based on interaction state
            const errorMessage = {
                content: '❌ An error occurred while verifying the user. Please check my permissions and try again.',
                ephemeral: true
            };

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply(errorMessage);
                } else if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else {
                    await interaction.followUp(errorMessage);
                }
            } catch (replyError) {
                console.error('Could not send error message:', replyError.message);
            }
        }
    }
};

