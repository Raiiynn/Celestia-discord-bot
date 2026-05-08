const { SlashCommandBuilder } = require('discord.js');
const storage = require('../../utils/storage');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask ChatGPT a question')
    .addStringOption(o =>
      o.setName('question')
        .setDescription('Your question, "clear" to reset history, or "stats" for usage info')
        .setRequired(true)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('question').trim();

    if (input.toLowerCase() === 'clear') {
      await storage.clearAiHistory(interaction.user.id);
      return interaction.reply({ content: 'Conversation history cleared.', ephemeral: true });
    }

    if (input.toLowerCase() === 'stats') {
      const history = await storage.getAiHistory(interaction.user.id);
return interaction.reply({
        content: `Stats: Turns in memory: ${history.length}`,
        ephemeral: true,
      });
    }

    if (!config.openRouterKey) {
      return interaction.reply({ content: '❌ OpenRouter API key not configured', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const history = await storage.getAiHistory(interaction.user.id);
      
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful assistant. Answer in Indonesian or English based on user preference. Be concise.'
        },
        ...history.map(msg => ({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.parts[0].text
        }))
      ];
      messages.push({ role: 'user', content: input });

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://discord.com',
          'X-Title': 'Celestia Bot',
        },
        body: JSON.stringify({
          model: 'gpt-oss-120b:free',
          messages: messages,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices[0].message.content;

      const newHistory = [
        ...history,
        { role: 'user', parts: [{ text: input }] },
        { role: 'model', parts: [{ text }] },
      ].slice(-20);
      await storage.saveAiHistory(interaction.user.id, newHistory);

      const reply = text.length > 1900 ? text.slice(0, 1900) + '…' : text;
      await interaction.editReply(`${reply}`);
    } catch (e) {
      console.error('[Ask Error]', e.message);
      await interaction.editReply(`Error: ${e.message}`);
    }
  },
};