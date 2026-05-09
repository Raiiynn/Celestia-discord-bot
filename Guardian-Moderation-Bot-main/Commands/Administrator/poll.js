const {
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const EmbedGenerator = require('../../Functions/embedGenerator');
const { sendModLog } = require('../../Functions/modLog');

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Start an interactive poll')
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
        .addStringOption((option) =>
            option
                .setName('question')
                .setDescription('The poll question')
                .setRequired(true)
                .setMaxLength(256)
        )
        .addStringOption((option) =>
            option
                .setName('option1')
                .setDescription('First poll option')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName('option2')
                .setDescription('Second poll option')
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName('option3')
                .setDescription('Third poll option (optional)')
                .setRequired(false)
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName('option4')
                .setDescription('Fourth poll option (optional)')
                .setRequired(false)
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName('option5')
                .setDescription('Fifth poll option (optional)')
                .setRequired(false)
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName('option6')
                .setDescription('Sixth poll option (optional)')
                .setRequired(false)
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName('option7')
                .setDescription('Seventh poll option (optional)')
                .setRequired(false)
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName('option8')
                .setDescription('Eighth poll option (optional)')
                .setRequired(false)
                .setMaxLength(100)
        )
        .addStringOption((option) =>
            option
                .setName('option9')
                .setDescription('Ninth poll option (optional)')
                .setRequired(false)
                .setMaxLength(100)
        )
        .addIntegerOption((option) =>
            option
                .setName('duration')
                .setDescription('Poll duration in minutes (optional, default: unlimited)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10080)
        ),
    cooldownTime: 20 * 1000,
    async execute(interaction, client, dbGuild) {
        const question = interaction.options.getString('question');
        const duration = interaction.options.getInteger('duration');

        // Collect all options
        const allOptions = [];
        for (let i = 1; i <= 9; i++) {
            const option = interaction.options.getString(`option${i}`);
            if (option) {
                allOptions.push(option);
            }
        }

        // Validate options
        if (allOptions.length < 2) {
            return interaction.reply({
                content: '❌ You need at least 2 poll options!',
                ephemeral: true,
            });
        }

        if (allOptions.length > 9) {
            return interaction.reply({
                content: '❌ Maximum 9 poll options allowed!',
                ephemeral: true,
            });
        }

        // Build the initial embed with live voting display
        const buildPollEmbed = (votes = null) => {
            const embed = EmbedGenerator.basicEmbed()
                .setColor(0x5865f2)
                .setTitle(`📊 ${question}`)
                .setAuthor({
                    name: `Poll by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/1995/1995467.png');

            if (!votes) {
                // Initial embed
                allOptions.forEach((option, index) => {
                    embed.addFields({
                        name: `${numberEmojis[index]} ${option}`,
                        value: `${'▮'.repeat(0)}▯▯▯▯▯▯▯▯▯▯ 0 votes (0%)`,
                        inline: false,
                    });
                });
            } else {
                // Results embed
                const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
                allOptions.forEach((option, index) => {
                    const voteCount = votes[index] || 0;
                    const percentage =
                        totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0;
                    const filledBars = Math.round((percentage / 100) * 20);
                    const emptyBars = 20 - filledBars;
                    const bar = '▮'.repeat(filledBars) + '▯'.repeat(emptyBars);
                    const winner =
                        totalVotes > 0 && voteCount === Math.max(...Object.values(votes))
                            ? '👑 '
                            : '';

                    embed.addFields({
                        name: `${numberEmojis[index]} ${option}`,
                        value: `${bar} **${voteCount}** vote${voteCount !== 1 ? 's' : ''} (**${percentage}%**)`,
                        inline: false,
                    });
                });
            }

            if (duration) {
                embed.addFields({
                    name: '⏱️ Duration',
                    value: `${duration} minute${duration > 1 ? 's' : ''}`,
                    inline: true,
                });
            } else {
                embed.addFields({
                    name: '⏱️ Duration',
                    value: `∞ Unlimited (Never ends)`,
                    inline: true,
                });
            }

            embed
                .setFooter({
                    text: votes
                        ? `Poll Ended • ${Object.values(votes).reduce((a, b) => a + b, 0)} total votes`
                        : 'React to vote!',
                })
                .setTimestamp();

            return embed;
        };

        // Send the poll
        const pollMessage = await interaction.reply({
            embeds: [buildPollEmbed()],
            fetchReply: true,
        });

        const logEmbed = EmbedGenerator.basicEmbed(
            [
                `- Moderator: ${interaction.user.tag}`,
                `- Channel: <#${interaction.channel.id}>`,
                `- Question: ${question}`,
                `- Options: ${allOptions.length}`,
                `- Duration: ${duration ? duration + ' minutes' : 'Unlimited'}`,
            ].join('\n')
        ).setTitle('/poll command used');
        await sendModLog(interaction.guild, dbGuild, logEmbed);

        // Add reactions
        for (let i = 0; i < allOptions.length; i++) {
            await pollMessage.react(numberEmojis[i]);
            await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // Function to collect and display votes
        const updateVotes = async () => {
            try {
                const updatedMessage = await pollMessage.channel.messages.fetch(pollMessage.id);
                const votes = {};

                updatedMessage.reactions.cache.forEach((reaction) => {
                    const emojiIndex = numberEmojis.indexOf(reaction.emoji.name);
                    if (emojiIndex !== -1) {
                        votes[emojiIndex] = Math.max(0, reaction.count - 1); // Subtract bot reaction
                    }
                });

                // Fill in missing options with 0
                for (let i = 0; i < allOptions.length; i++) {
                    if (votes[i] === undefined) {
                        votes[i] = 0;
                    }
                }

                const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
                if (totalVotes > 0) {
                    await pollMessage.edit({ embeds: [buildPollEmbed(votes)] });
                }
            } catch (error) {
                console.error('Error updating poll:', error);
            }
        };

        // Real-time reaction listeners
        const reactionAddListener = async (reaction, user) => {
            if (reaction.message.id !== pollMessage.id || user.bot) return;
            await updateVotes();
        };

        const reactionRemoveListener = async (reaction, user) => {
            if (reaction.message.id !== pollMessage.id || user.bot) return;
            await updateVotes();
        };

        interaction.client.on('messageReactionAdd', reactionAddListener);
        interaction.client.on('messageReactionRemove', reactionRemoveListener);

        // Cleanup function
        const cleanup = () => {
            interaction.client.removeListener('messageReactionAdd', reactionAddListener);
            interaction.client.removeListener('messageReactionRemove', reactionRemoveListener);
        };

        // Handle poll expiration
        if (duration) {
            const durationMs = duration * 60 * 1000;
            setTimeout(async () => {
                cleanup();

                try {
                    const updatedMessage = await pollMessage.channel.messages.fetch(pollMessage.id);
                    const votes = {};

                    updatedMessage.reactions.cache.forEach((reaction) => {
                        const emojiIndex = numberEmojis.indexOf(reaction.emoji.name);
                        if (emojiIndex !== -1) {
                            votes[emojiIndex] = Math.max(0, reaction.count - 1);
                        }
                    });

                    // Fill in missing options with 0
                    for (let i = 0; i < allOptions.length; i++) {
                        if (votes[i] === undefined) {
                            votes[i] = 0;
                        }
                    }

                    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
                    const resultsEmbed = EmbedGenerator.basicEmbed()
                        .setColor(0x2ecc71)
                        .setTitle(`✅ Poll Results: ${question}`)
                        .setAuthor({
                            name: `Poll by ${interaction.user.username}`,
                            iconURL: interaction.user.displayAvatarURL(),
                        })
                        .setThumbnail('https://cdn-icons-png.flaticon.com/512/1995/1995467.png');

                    // Find the winner
                    const maxVotes = Math.max(...Object.values(votes));
                    const winner = allOptions.find((_, idx) => votes[idx] === maxVotes);

                    allOptions.forEach((option, index) => {
                        const voteCount = votes[index] || 0;
                        const percentage =
                            totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0;
                        const filledBars = Math.round((percentage / 100) * 20);
                        const emptyBars = 20 - filledBars;
                        const bar = '▮'.repeat(filledBars) + '▯'.repeat(emptyBars);
                        const isWinner = voteCount === maxVotes && totalVotes > 0 ? '👑 ' : '';

                        resultsEmbed.addFields({
                            name: `${numberEmojis[index]} ${option}`,
                            value: `${bar} **${voteCount}** vote${voteCount !== 1 ? 's' : ''} (**${percentage}%**)`,
                            inline: false,
                        });
                    });

                    resultsEmbed
                        .addFields({
                            name: '🏆 Winner',
                            value:
                                totalVotes > 0
                                    ? `**${winner}** with ${maxVotes} vote${maxVotes !== 1 ? 's' : ''}`
                                    : 'No votes cast',
                            inline: false,
                        })
                        .setFooter({
                            text: `Poll Ended • Total votes: ${totalVotes}`,
                        })
                        .setTimestamp();

                    await pollMessage.reply({ embeds: [resultsEmbed] });
                } catch (error) {
                    console.error('Error calculating poll results:', error);
                }
            }, durationMs);
        }
    },
};
