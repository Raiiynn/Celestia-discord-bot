const Discord = require('discord.js');
const Guilds = require('../Schemas/Guilds');
const EmbedGenerator = require('../Functions/embedGenerator');

/**
 * @param {Discord.Guild} raidedGuild 
 * @param {Discord.Client} client 
 * @param {Object} raidData 
 * @param {Array} raiders 
 */
async function broadcastRaidAlert(raidedGuild, client, raidData, raiders) {
    try {
        const guildsWithGlobalLogging = await Guilds.find({
            'logs.enabled': true,
            'logs.global': { $exists: true, $ne: null }
        });

        const eligibleGuilds = raidData.isTest 
            ? guildsWithGlobalLogging
            : guildsWithGlobalLogging.filter(guild => guild.antiraid?.enabled);

        if (eligibleGuilds.length === 0) {
            console.log(`❌ No guilds available for ${raidData.isTest ? 'test' : 'real'} raid alerts`);
            return;
        }

        console.log(`📡 Broadcasting ${raidData.isTest ? 'TEST' : 'REAL'} raid alert to ${eligibleGuilds.length} guilds`);

        const raidEmbed = new Discord.EmbedBuilder()
            .setColor(raidData.isTest ? 'Orange' : 'Red')
            .setTitle(`${raidData.isTest ? '🧪' : '🚨'} Cross-Server Raid Alert${raidData.isTest ? ' (TEST)' : ''}`)
            .setThumbnail(raidedGuild.iconURL({ dynamic: true, size: 256 }))
            .setAuthor({
                name: 'Guardian',
                iconURL: client.user.displayAvatarURL({ dynamic: true }),
                url: 'https://discord.gg/5nWZ8BJae4'
            })
            .setDescription(
                `${raidData.isTest ? '## 🧪 **TEST MODE**\nThis is a test alert to verify the cross-server protection system.\n\n' : '## 🚨 **IMMEDIATE THREAT DETECTED**\n'}` +
                `**${raidData.isTest ? 'Mock raid' : 'Coordinated raid'} detected in another Guardian-protected server!**\n\n` +
                `>>> **🏰 Target Server:** ${raidedGuild.name}\n` +
                `**🆔 Server ID:** \`${raidedGuild.id}\`\n` +
                `**👥 Raider Count:** **${raiders.length}** users\n` +
                `**⚡ Detection Rate:** **${raidData.joinCount}** joins in **${raidData.joinWithin}** seconds\n` +
                `**⚖️ Action Taken:** **${raidData.action === 'ban' ? 'BANNED' : 'KICKED'}**\n` +
                `**🕐 Detection Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
            )
            .addFields(
                { 
                    name: '🛡️ **Your Protection Status**', 
                    value: `✅ **Anti-Raid:** Enabled in your server\n🔒 **Global Logging:** Active\n🚨 **Cross-Server Defense:** Operational`,
                    inline: true 
                },
                { 
                    name: '⚠️ **Recommended Actions**', 
                    value: raidData.isTest 
                        ? '🧪 **Test Mode:** No action needed\n✅ **System Verified:** Working correctly'
                        : '🔒 **Enable Lockdown:** Temporary protection\n📈 **Increase Verification:** Strengthen security\n👀 **Monitor Activity:** Watch for suspicious behavior',
                    inline: true 
                }
            )
            .addFields(
                {
                    name: `📊 **Threat Analysis**`,
                    value: `**Severity Level:** ${raidData.joinCount >= 20 ? '🔴 **CRITICAL**' : raidData.joinCount >= 10 ? '🟡 **HIGH**' : '🟠 **ELEVATED**'}\n` +
                            `**Attack Pattern:** ${raidData.joinWithin <= 10 ? '⚡ **Lightning Fast**' : raidData.joinWithin <= 30 ? '🚀 **Rapid**' : '📈 **Sustained**'}\n` +
                            `**Response Time:** **Instant**\n` +
                            `**Network Defense:** **Active**`,
                    inline: false
                }
            )
            .setImage('https://cdn.discordapp.com/attachments/1048758700984270918/1048758701648654396/banner.png')
            .setFooter({ 
                text: `Guardian Cross-Server Protection${raidData.isTest ? ' • TEST MODE' : ''} • Defending ${client.guilds.cache.size} servers`,
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();

        if (raiders.length > 0) {
            const raiderList = raiders.slice(0, 10).map((raider, index) => {
                const user = client.users.cache.get(raider.userId);
                return `${index + 1}. ${user ? user.tag : `Unknown User (${raider.userId})`}`;
            }).join('\n');

            raidEmbed.addFields({
                name: `🎭 **Known Raiders${raiders.length > 10 ? ` (First ${Math.min(raiders.length, 10)} shown)` : ''}**`,
                value: raiderList || 'No raider data available'
            });

            if (raiders.length > 10) {
                raidEmbed.addFields({
                    name: '� **Additional Intelligence**',
                    value: `...and **${raiders.length - 10}** more raiders detected in the attack wave`
                });
            }
        }

        const actionRow = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId(`raid_ban_${raidedGuild.id}`)
                    .setLabel(raidData.isTest ? '🧪 Test Defense' : '🔨 Preemptive Ban')
                    .setStyle(raidData.isTest ? Discord.ButtonStyle.Primary : Discord.ButtonStyle.Danger)
                    .setEmoji(raidData.isTest ? '🧪' : '🔨')
                    .setDisabled(raidData.isTest),
                new Discord.ButtonBuilder()
                    .setCustomId(`raid_info_${raidedGuild.id}`)
                    .setLabel('📊 Threat Intel')
                    .setStyle(Discord.ButtonStyle.Primary)
                    .setEmoji('📊'),
                new Discord.ButtonBuilder()
                    .setCustomId(`raid_dismiss_${raidedGuild.id}`)
                    .setLabel('✅ Acknowledge')
                    .setStyle(Discord.ButtonStyle.Secondary)
                    .setEmoji('✅')
            );

        const sentGuilds = [];
        const skippedGuilds = [];
        
        for (const guildDoc of eligibleGuilds) {
            try {
                // Skip the raided guild itself for real alerts, but allow it for test mode
                if (guildDoc.guild === raidedGuild.id && !raidData.isTest) {
                    skippedGuilds.push({ name: raidedGuild.name, reason: 'Raided guild (skipped)' });
                    continue;
                }

                const guild = client.guilds.cache.get(guildDoc.guild);
                if (!guild) {
                    skippedGuilds.push({ name: guildDoc.guild, reason: 'Guild not found in cache' });
                    continue;
                }

                const globalChannel = guild.channels.cache.get(guildDoc.logs.global);
                if (!globalChannel || !globalChannel.isTextBased()) {
                    skippedGuilds.push({ name: guild.name, reason: 'Global channel not found or not text-based' });
                    continue;
                }

                if (!globalChannel.permissionsFor(client.user).has(['SendMessages', 'EmbedLinks'])) {
                    skippedGuilds.push({ name: guild.name, reason: 'Missing permissions (SendMessages/EmbedLinks)' });
                    continue;
                }

                console.log(`📤 Sending ${raidData.isTest ? 'TEST' : 'REAL'} raid alert to ${guild.name} in channel ${globalChannel.name}`);
                await globalChannel.send({
                    embeds: [raidEmbed],
                    components: [actionRow]
                });

                sentGuilds.push(guild.name);
            } catch (error) {
                console.error(`Failed to send raid alert to guild ${guildDoc.guild}:`, error);
                skippedGuilds.push({ name: guildDoc.guild, reason: `Error: ${error.message}` });
            }
        }

        console.log(`🚨 Cross-server raid alert (${raidData.isTest ? 'TEST' : 'REAL'}) sent to ${sentGuilds.length} guilds: ${sentGuilds.join(', ')}`);
        
        if (skippedGuilds.length > 0) {
            console.log(`⚠️ Skipped ${skippedGuilds.length} guilds:`);
            skippedGuilds.forEach(skipped => {
                console.log(`   - ${skipped.name}: ${skipped.reason}`);
            });
        }

    } catch (error) {
        console.error('Error in broadcastRaidAlert:', error);
    }
}

/**
 * @param {Discord.ButtonInteraction} interaction
 * @param {Discord.Client} client
 */
async function handleRaidButtonInteraction(interaction, client) {
    const customId = interaction.customId;
    
    if (!customId.startsWith('raid_')) return;

    await interaction.deferReply({ ephemeral: true });

    try {
        const [, action, raidedGuildId] = customId.split('_');
        
        const raidedGuildDoc = await Guilds.findOne({ guild: raidedGuildId });
        if (!raidedGuildDoc) {
            return interaction.editReply({
                embeds: [EmbedGenerator.errorEmbed('Unable to find raided guild information.')]
            });
        }

        const raidedGuild = client.guilds.cache.get(raidedGuildId);
        if (!raidedGuild) {
            return interaction.editReply({
                embeds: [EmbedGenerator.errorEmbed('Raided guild is no longer available.')]
            });
        }

        switch (action) {
            case 'ban':
                await handleBanRaiders(interaction, client, raidedGuild, raidedGuildDoc);
                break;
            case 'info':
                await handleRaidInfo(interaction, client, raidedGuild, raidedGuildDoc);
                break;
            case 'dismiss':
                await interaction.editReply({
                    embeds: [EmbedGenerator.basicEmbed('✅ Raid alert dismissed.')]
                });
                break;
        }
    } catch (error) {
        console.error('Error handling raid button interaction:', error);
        await interaction.editReply({
            embeds: [EmbedGenerator.errorEmbed('Failed to process your request.')]
        });
    }
}

async function handleBanRaiders(interaction, client, raidedGuild, raidedGuildDoc) {
    try {

        const { getRecentJoiners } = require('../Functions/antiRaidTracking');
        const recentJoiners = getRecentJoiners(raidedGuild.id, 300000); // 5 minutes
        
        if (recentJoiners.length === 0) {
            return interaction.editReply({
                embeds: [EmbedGenerator.basicEmbed('No recent raiders found to ban.')]
            });
        }

        const userGuild = interaction.guild;
        let bannedCount = 0;
        let failedCount = 0;
        let notFoundCount = 0;

        for (const raiderId of recentJoiners) {
            try {
                const member = await userGuild.members.fetch(raiderId).catch(() => null);
                if (!member) {
                    notFoundCount++;
                    continue;
                }

                if (member.id === userGuild.ownerId || 
                    member.permissions.has(Discord.PermissionFlagsBits.Administrator)) {
                    failedCount++;
                    continue;
                }

                await member.ban({ 
                    reason: `Cross-server raid protection - Preemptive ban from raid in ${raidedGuild.name}` 
                });
                bannedCount++;
            } catch (error) {
                failedCount++;
            }
        }

        const resultEmbed = EmbedGenerator.basicEmbed(
            `**Cross-Server Raid Protection Complete**\n\n` +
            `🔨 **Banned:** ${bannedCount} raiders\n` +
            `❌ **Failed:** ${failedCount} raiders\n` +
            `👻 **Not Found:** ${notFoundCount} raiders\n\n` +
            `Your server is now protected from the raiders that attacked **${raidedGuild.name}**!`
        )
        .setColor('Green')
        .setTitle('✅ Preemptive Ban Complete')
        .setFooter({ text: 'Guardian Cross-Server Protection' });

        await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
        console.error('Error in handleBanRaiders:', error);
        await interaction.editReply({
            embeds: [EmbedGenerator.errorEmbed('Failed to ban raiders. Please check permissions.')]
        });
    }
}

async function handleRaidInfo(interaction, client, raidedGuild, raidedGuildDoc) {
    try {
        const { getRecentJoiners } = require('../Functions/antiRaidTracking');
        const recentJoiners = getRecentJoiners(raidedGuild.id, 300000);

        const infoEmbed = new Discord.EmbedBuilder()
            .setColor('Orange')
            .setTitle('📊 Raid Details')
            .setThumbnail(raidedGuild.iconURL({ dynamic: true }))
            .setDescription(`Detailed information about the raid in **${raidedGuild.name}**`)
            .addFields(
                { name: '🏰 Server Info', value: `Name: ${raidedGuild.name}\nID: ${raidedGuild.id}\nMembers: ${raidedGuild.memberCount}`, inline: true },
                { name: '🛡️ Protection Settings', value: `Enabled: ✅\nAction: ${raidedGuildDoc.antiraid.action}\nThreshold: ${raidedGuildDoc.antiraid.joinAmount} joins/${raidedGuildDoc.antiraid.joinWithin}s`, inline: true },
                { name: '👥 Raider Count', value: `${recentJoiners.length} users detected`, inline: true }
            )
            .setFooter({ text: 'Guardian Cross-Server Protection' })
            .setTimestamp();

        if (recentJoiners.length > 0) {
            const raiderDetails = recentJoiners.slice(0, 15).map((raiderId, index) => {
                const user = client.users.cache.get(raiderId);
                return `${index + 1}. ${user ? user.tag : `Unknown (${raiderId})`}`;
            }).join('\n');

            infoEmbed.addFields({
                name: `🎭 Recent Raiders (${Math.min(recentJoiners.length, 15)} shown)`,
                value: raiderDetails || 'No data available'
            });
        }

        await interaction.editReply({ embeds: [infoEmbed] });

    } catch (error) {
        console.error('Error in handleRaidInfo:', error);
        await interaction.editReply({
            embeds: [EmbedGenerator.errorEmbed('Failed to fetch raid details.')]
        });
    }
}

module.exports = {
    broadcastRaidAlert,
    handleRaidButtonInteraction
};
