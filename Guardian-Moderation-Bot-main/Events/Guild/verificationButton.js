const Discord = require('discord.js');
const Captcha = require('captcha-generator-alphanumeric').default;

const EmbedGenerator = require('../../Functions/embedGenerator');
const { GuildsManager } = require('../../Classes/GuildsManager');
const { UsersManager } = require('../../Classes/UsersManager');

module.exports = {
    name: 'interactionCreate',
    /**
     * @param {Discord.Interaction} interaction
     */
    async execute(interaction) {
        if (interaction.isButton() && interaction.customId === 'verification') {
            const guild = await GuildsManager.fetch(interaction.guild.id);
            if (!guild.verification.enabled)
                return interaction.reply({
                    embeds: [
                        EmbedGenerator.errorEmbed(
                            "This guild doesn't have the Verification system enabled."
                        ),
                    ],
                    ephemeral: true,
                });

            if (
                !guild.verification.unverifiedRole ||
                !interaction.member?.roles?.cache.has(guild.verification.unverifiedRole)
            )
                return interaction.reply({
                    embeds: [EmbedGenerator.errorEmbed('You are already verified.')],
                    ephemeral: true,
                });

            if (guild.verification.version === 'button') {
                await interaction.member.roles
                    .remove(guild.verification.unverifiedRole, 'Verification completed')
                    .catch(() => {
                        return interaction.reply({
                            embeds: [EmbedGenerator.errorEmbed()],
                            ephemeral: true,
                        });
                    });
                if (guild.verification.role) {
                    await interaction.member.roles
                        .add(guild.verification.role, 'Verification completed')
                        .catch(() => null);
                }

                return interaction.reply({
                    embeds: [EmbedGenerator.basicEmbed('Verification completed.')],
                    ephemeral: true,
                });
            }

            if (guild.verification.version === 'captcha') {
                const dbUser = await UsersManager.fetch(interaction.user.id, interaction.guild.id);
                const generatedCaptcha = new Captcha();
                dbUser.captcha = generatedCaptcha.value;

                return interaction.reply({
                    embeds: [
                        EmbedGenerator.basicEmbed(
                            'Please enter the captcha shown below to complete verification.'
                        )
                            .setTitle(`Captcha Verification | ${interaction.guild.name}`)
                            .setImage('attachment://captcha.jpg')
                            .setFooter({
                                text: 'Click the button below to enter the captcha.',
                            }),
                    ],
                    files: [
                        new Discord.AttachmentBuilder(generatedCaptcha.JPEGStream).setName(
                            'captcha.jpg'
                        ),
                    ],
                    components: [
                        new Discord.ActionRowBuilder().addComponents([
                            new Discord.ButtonBuilder()
                                .setCustomId('verification_captcha_input')
                                .setLabel('Enter Captcha')
                                .setStyle(Discord.ButtonStyle.Primary),
                        ]),
                    ],
                    ephemeral: true,
                });
            }

            return interaction.reply({
                embeds: [EmbedGenerator.errorEmbed('This guild uses a command for verification.')],
                ephemeral: true,
            });
        }

        if (interaction.isButton() && interaction.customId === 'verification_captcha_input') {
            const guild = await GuildsManager.fetch(interaction.guild.id);
            if (!guild.verification.enabled || guild.verification.version !== 'captcha')
                return interaction.reply({
                    embeds: [EmbedGenerator.errorEmbed('Verification is not available.')],
                    ephemeral: true,
                });

            const modal = new Discord.ModalBuilder()
                .setCustomId('verification_captcha_modal')
                .setTitle('Enter Captcha');

            const captchaInput = new Discord.TextInputBuilder()
                .setCustomId('captcha_input')
                .setLabel('Captcha Code')
                .setStyle(Discord.TextInputStyle.Short)
                .setPlaceholder('Enter the 6-character captcha')
                .setMinLength(6)
                .setMaxLength(6)
                .setRequired(true);

            const actionRow = new Discord.ActionRowBuilder().addComponents(captchaInput);
            modal.addComponents(actionRow);

            return interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'verification_captcha_modal') {
            const guild = await GuildsManager.fetch(interaction.guild.id);
            if (!guild.verification.enabled || guild.verification.version !== 'captcha')
                return interaction.reply({
                    embeds: [EmbedGenerator.errorEmbed('Verification is not available.')],
                    ephemeral: true,
                });

            if (
                !guild.verification.unverifiedRole ||
                !interaction.member?.roles?.cache.has(guild.verification.unverifiedRole)
            )
                return interaction.reply({
                    embeds: [EmbedGenerator.errorEmbed('You are already verified.')],
                    ephemeral: true,
                });

            const dbUser = await UsersManager.fetch(interaction.user.id, interaction.guild.id);
            const captchaInput = interaction.fields.getTextInputValue('captcha_input');

            if (!dbUser.captcha) {
                return interaction.reply({
                    embeds: [
                        EmbedGenerator.errorEmbed(
                            'No captcha found. Please click the verify button again.'
                        ),
                    ],
                    ephemeral: true,
                });
            }

            if (captchaInput.toUpperCase() === dbUser.captcha) {
                await interaction.member.roles
                    .remove(guild.verification.unverifiedRole, 'Verification completed')
                    .catch(() => {
                        return interaction.reply({
                            embeds: [EmbedGenerator.errorEmbed()],
                            ephemeral: true,
                        });
                    });
                if (guild.verification.role) {
                    await interaction.member.roles
                        .add(guild.verification.role, 'Verification completed')
                        .catch(() => null);
                }

                dbUser.captcha = null;

                return interaction.reply({
                    embeds: [EmbedGenerator.basicEmbed('Verification completed.')],
                    ephemeral: true,
                });
            } else {
                return interaction.reply({
                    embeds: [EmbedGenerator.errorEmbed('The captcha you provided is incorrect.')],
                    ephemeral: true,
                });
            }
        }
    },
};
