const Discord = require(`discord.js`);

const EmbedGenerator = require('../../Functions/embedGenerator');
const Guilds = require('../../Schemas/Guilds');

/** @typedef {{ id: number; label: string; warningOnFailure: boolean; check: (dbGuild: import('../../Classes/GuildsManager').GuildsManager) => boolean }} SetupStep */

const SETUP_STEPS = [
    {
        id: 0,
        label: 'Checking for permissions...',
        warningOnFailure: false,
        check: () => true,
    },
    {
        id: 1,
        label: "Checking Guardian's role position (should be above the roles it needs to manage)...",
        warningOnFailure: true,
        check: () => true,
    },
    {
        id: 2,
        label: 'Basic log channel',
        warningOnFailure: false,
        check: (g) => !!g?.logs?.basic,
    },
    {
        id: 3,
        label: 'Mod log channel',
        warningOnFailure: false,
        check: (g) => !!g?.logs?.moderator,
    },
    {
        id: 4,
        label: 'Suggestions channel',
        warningOnFailure: false,
        check: (g) => !!g?.logs?.suggestionsChannel || !!g?.suggestion?.channel,
    },
    {
        id: 5,
        label: 'Announcement channel',
        warningOnFailure: false,
        check: (g) => !!g?.logs?.announcementChannel,
    },
    {
        id: 6,
        label: 'Giveaway channel',
        warningOnFailure: false,
        check: (g) => !!g?.logs?.giveawayChannel,
    },
    {
        id: 7,
        label: 'Suggestion system enabled',
        warningOnFailure: false,
        check: (g) => !!g?.suggestion?.enabled && !!g?.suggestion?.channel,
    },
    {
        id: 8,
        label: 'Ticket system',
        warningOnFailure: false,
        check: (g) =>
            !!g?.tickets?.enabled &&
            !!g?.tickets?.channel &&
            !!g?.tickets?.category &&
            !!g?.tickets?.role,
    },
    {
        id: 9,
        label: 'Finishing up...',
        warningOnFailure: false,
        check: () => true,
    },
];

module.exports = {
    enabled: true,
    data: new Discord.SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup basic bot stuff.')
        .setDefaultMemberPermissions(
            Discord.PermissionFlagsBits.ManageChannels |
                Discord.PermissionFlagsBits.ManageRoles |
                Discord.PermissionFlagsBits.ViewAuditLog |
                Discord.PermissionFlagsBits.SendMessages
        )
        .setDMPermission(false),
    /**
     * @param {Discord.ChatInputCommandInteraction} interaction
     * @param {Discord.Client} client
     * @param {import('../../Classes/GuildsManager').GuildsManager} dbGuild
     */
    async execute(interaction, client, dbGuild) {
        await interaction.reply({
            embeds: [generateEmbed(0, [], dbGuild)],
            components: getSetupComponents(dbGuild),
        });

        if (!interaction.guild.members.me.permissions.has('Administrator')) {
            const embed = generateEmbed(0, [], dbGuild);
            embed
                .setColor('Red')
                .setDescription(
                    [
                        '```diff',
                        '- Bot is missing the administrator permissions! -',
                        '```',
                        '',
                        "❌ Please grant the `Administrator` permission to the bot's role and run `/setup` again.",
                    ].join('\n')
                );
            return interaction.editReply({ embeds: [embed], components: [] });
        }

        await interaction.editReply({
            embeds: [generateEmbed(1, [0], dbGuild)],
            components: getSetupComponents(dbGuild),
        });

        const botRole = interaction.guild.roles.botRoleFor(client.user);
        if (!botRole) {
            const embed = generateEmbed(1, [0], dbGuild);
            embed
                .setColor('Red')
                .setDescription(
                    '❌ Bot role not found. Please ensure the bot has a role in this server.'
                );
            await interaction.editReply({ embeds: [embed], components: [] });
            return;
        }

        const rolesAboveBot = interaction.guild.roles.cache.filter(
            (role) => role.position > botRole.position && !role.managed && role.editable
        );
        if (rolesAboveBot.size > 0) {
            const embed = generateEmbed(1, [0], dbGuild);
            embed
                .setColor('Yellow')
                .setDescription(
                    [
                        `\`\`\`fix\n! The bot role is not the highest role in the server !\n\`\`\``,
                        '',
                        `⚠️ Some role-based actions might fail if higher roles exist above the bot.`,
                        '',
                        '**How to fix:**',
                        "• Go to your server's roles settings",
                        "• Drag the Guardian bot's role **above** the roles it needs to manage",
                        '• Run `/setup` again if you have issues',
                    ].join('\n')
                );
            return interaction.editReply({
                embeds: [embed],
                components: getSetupComponents(dbGuild),
            });
        }

        const completed = [0, 1];
        for (let i = 2; i < SETUP_STEPS.length; i++) {
            const step = SETUP_STEPS[i];
            if (step.check(dbGuild)) completed.push(step.id);
            await interaction.editReply({
                embeds: [generateEmbed(i + 1, completed, dbGuild)],
                components: getSetupComponents(dbGuild),
            });
            await new Promise((resolve) => setTimeout(() => resolve(), 300));
        }

        await interaction.editReply({
            embeds: [generateEmbed(SETUP_STEPS.length, completed, dbGuild)],
            components: getSetupComponents(dbGuild),
        });

        await Guilds.updateOne({ guild: interaction.guild.id }, { $set: { setup: true } });
        dbGuild.document.setup = true;
    },
};

/**
 * @param {Number} count
 * @param {Array<Number>} completed
 * @param {import('../../Classes/GuildsManager').GuildsManager} dbGuild
 */
function generateEmbed(count, completed, dbGuild) {
    const stepInfo = [
        'Ensures bot can modify/manage everything required.',
        'Checks if Guardian can actually manage your server roles.',
        'Needed for logging moderation/commands.',
        'Allows logging moderation actions.',
        'Suggestion posts will appear here.',
        'Important server announcements go here.',
        'Giveaway info & winners go here.',
        'Suggestion system POSTING support.',
        'Ticketing system for support, reports, etc.',
        'Finalize and save config.',
    ];

    let lines = [
        '```ansi',
        '\u001b[1;36m[ QUICK SETUP PROGRESS ]\u001b[0m',
        '```',
        '',
        '**Current server checks:**',
        '',
    ];

    SETUP_STEPS.forEach((step, idx) => {
        if (count < idx) return;

        let prefix = '🕓';
        if (count > idx) {
            if (completed.includes(step.id)) {
                prefix = '✅';
            } else if (step.warningOnFailure) {
                prefix = '⚠️';
            } else {
                prefix = '❌';
            }
        }

        lines.push(
            [
                `**${prefix} [${idx + 1}/${SETUP_STEPS.length}]** \`${step.label}\``,
                `> _${stepInfo[idx]}_`,
            ].join('\n')
        );
    });

    if (count < SETUP_STEPS.length) {
        lines.push('\n*Proceeding through setup...*\n');
        lines.push('**Tip:** If a step fails, its reason and fix will be shown.');
    } else {
        lines.push(
            '',
            '```diff\n+ All system checks complete! +\n```',
            '🎉 **Guardian is fully configured! Use `/help` to further customize.**'
        );
    }

    if (count === 0) {
        lines.push(
            '',
            '**What the setup checks for:**',
            '• Permissions (Administrator, Manage Roles, etc)',
            '• Role position of the bot',
            '• Channels for logging, suggestions, announcements, giveaways',
            '• If suggestion and ticket systems are working',
            '',
            '> *Interact with the Settings button for quick-fix modals or configuration screens!*'
        );
    }

    return EmbedGenerator.basicEmbed(lines.join('\n')).setTitle('🛡️ Guardian Setup Wizard');
}

/**
 * Build action rows: Settings button and optionally a select menu for setup commands.
 * @param {import('../../Classes/GuildsManager').GuildsManager} dbGuild
 * @returns {Discord.ActionRowBuilder[]}
 */
function getSetupComponents(dbGuild) {
    const needsLogging =
        !dbGuild?.logs?.basic ||
        !dbGuild?.logs?.moderator ||
        !dbGuild?.logs?.suggestionsChannel ||
        !dbGuild?.logs?.announcementChannel ||
        !dbGuild?.logs?.giveawayChannel;
    const needsSuggestion = !dbGuild?.suggestion?.enabled || !dbGuild?.suggestion?.channel;
    const needsTickets =
        !dbGuild?.tickets?.enabled ||
        !dbGuild?.tickets?.channel ||
        !dbGuild?.tickets?.category ||
        !dbGuild?.tickets?.role;

    const needsAnySetup = needsLogging || needsSuggestion || needsTickets;
    if (!needsAnySetup) return [];

    const selectOptions = [];
    if (needsLogging)
        selectOptions.push(
            new Discord.StringSelectMenuOptionBuilder()
                .setLabel('Logging & Channels')
                .setValue('logging')
                .setDescription(
                    'Configure log, mod log, suggestions, announcement & giveaway channels'
                )
                .setEmoji('📋')
        );
    if (needsSuggestion)
        selectOptions.push(
            new Discord.StringSelectMenuOptionBuilder()
                .setLabel('Suggestion System')
                .setValue('suggestion')
                .setDescription('Enable suggestions and set the suggestions channel')
                .setEmoji('💡')
        );
    if (needsTickets)
        selectOptions.push(
            new Discord.StringSelectMenuOptionBuilder()
                .setLabel('Ticket System')
                .setValue('tickets')
                .setDescription('Configure the ticket system')
                .setEmoji('🎫')
        );

    if (selectOptions.length === 0) return [];

    return [
        new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
                .setCustomId('setup_settings_button')
                .setLabel('Configure Settings')
                .setEmoji('⚙️')
                .setStyle(Discord.ButtonStyle.Primary)
        ),
    ];
}
