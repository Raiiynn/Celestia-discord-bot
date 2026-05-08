/**
 * Interaction Create Event
 * Handle slash commands and button/select menu interactions
 */

module.exports = {
  name: 'interactionCreate',
  once: false,
  
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands?.get(interaction.commandName);
        
        if (!command) {
          return interaction.reply({
            content: 'Command not found',
            flags: 64,
          });
        }

        try {
          await command.execute(interaction, client);
        } catch (err) {
          console.error(`[SlashCommand] Error executing ${interaction.commandName}:`, err);
          
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred', flags: 64 }).catch(() => {});
          }
        }
      }

      else if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        
        if (customId === 'help_category') {
          const command = client.commands?.get('help');
          if (command?.handleSelectMenu) {
            await command.handleSelectMenu(interaction);
          }
        }
      }

      else if (interaction.isButton()) {
        console.log(`[Button] Clicked: ${interaction.customId} by ${interaction.user.tag}`);
      }
    } catch (err) {
      console.error('[InteractionCreate] Error:', err);
    }
  }
};