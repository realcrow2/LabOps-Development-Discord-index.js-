// events/guildMemberRemove.js
const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load config
const config = require(path.join(__dirname, '../config.json'));

// Role backup storage file
const BACKUP_FILE = path.join(__dirname, '../role_backups.json');

// Helper functions
function loadBackups() {
    try {
        if (fs.existsSync(BACKUP_FILE)) {
            return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading backups:', error);
    }
    return {};
}

function saveBackups(backups) {
    try {
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(backups, null, 2));
    } catch (error) {
        console.error('Error saving backups:', error);
    }
}

function cleanExpiredBackups(backups) {
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    let cleaned = false;
    
    for (const [key, backup] of Object.entries(backups)) {
        if (now - backup.timestamp > twentyFourHours) {
            delete backups[key];
            console.log(`Removed expired backup for ${key}`);
            cleaned = true;
        }
    }
    
    if (cleaned) {
        saveBackups(backups);
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
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            // Check audit logs to see if user was kicked or banned (not voluntary leave)
            const fetchedLogs = await member.guild.fetchAuditLogs({
                limit: 1,
                type: 20, // MEMBER_KICK
            });
            
            const kickLog = fetchedLogs.entries.first();
            
            const fetchedBanLogs = await member.guild.fetchAuditLogs({
                limit: 1,
                type: 22, // MEMBER_BAN_ADD
            });
            
            const banLog = fetchedBanLogs.entries.first();
            
            // Check if the removal was a kick or ban within the last 5 seconds
            const wasKicked = kickLog && 
                kickLog.target.id === member.user.id && 
                (Date.now() - kickLog.createdTimestamp) < 5000;
                
            const wasBanned = banLog && 
                banLog.target.id === member.user.id && 
                (Date.now() - banLog.createdTimestamp) < 5000;
            
            // Only backup roles if they were kicked or banned, not if they left voluntarily
            if (!wasKicked && !wasBanned) {
                console.log(`${member.user.tag} left voluntarily - skipping role backup`);
                return;
            }
            
            // Get all roles except @everyone
            const roles = member.roles.cache
                .filter(role => role.id !== member.guild.id)
                .map(role => role.id);

            if (roles.length === 0) return;

            // Load existing backups
            const backups = loadBackups();
            
            // Clean expired backups
            cleanExpiredBackups(backups);

            // Store backup
            const backupKey = `${member.guild.id}-${member.user.id}`;
            backups[backupKey] = {
                userId: member.user.id,
                guildId: member.guild.id,
                roles: roles,
                username: member.user.tag,
                timestamp: Date.now()
            };

            saveBackups(backups);

            // Create log embed
            const logEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🛡️ Roles Backed Up')
                .setDescription(`Roles have been saved for **${member.user.tag}**`)
                .addFields(
                    { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
                    { name: 'Roles Saved', value: `${roles.length}`, inline: true },
                    { name: 'Valid Until', value: `<t:${Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000)}:R>`, inline: true },
                    { name: 'Role List', value: roles.map(id => `<@&${id}>`).join(', ') || 'None' }
                )
                .setTimestamp()
                .setFooter({ text: 'Role Backup System' });

            await sendLog(member.guild, logEmbed);
            console.log(`Backed up ${roles.length} roles for ${member.user.tag}`);
        } catch (error) {
            console.error('Error backing up roles:', error);
        }
    },
};