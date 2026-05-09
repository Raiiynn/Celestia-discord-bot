const Discord = require('discord.js');
const Guilds = require('../../Schemas/Guilds');

module.exports = {
    enabled: true,
    data: new Discord.SlashCommandBuilder()
        .setName('setup-toggle')
        .setDescription('Toggle the setup status of the server (Admin only)')
        .setDefaultMemberPermissions(Discord.PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),
    /**
     * @param {Discord.ChatInputCommandInteraction} interaction
     * @param {Discord.Client} client
     * @param {import('../../Classes/GuildsManager').GuildsManager} dbGuild
     */
    async execute(interaction, client, dbGuild) {
        const currentStatus = dbGuild.setup;
        const newStatus = !currentStatus;

        await Guilds.updateOne({ guild: interaction.guild.id }, { $set: { setup: newStatus } });
        dbGuild.document.setup = newStatus;

        const embed = new Discord.EmbedBuilder()
            .setColor(newStatus ? 0x00ff00 : 0xff0000)
            .setTitle('Setup Status Toggled')
            .setDescription(
                `Server setup status is now: **${newStatus ? '✅ Complete' : '❌ Incomplete'}**`
            )
            .addFields({
                name: 'What this means:',
                value: newStatus
                    ? 'All commands are now available for use in this server.'
                    : 'Only the `/setup` command can be used until setup is completed.',
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
