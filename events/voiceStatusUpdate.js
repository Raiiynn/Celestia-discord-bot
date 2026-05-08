const musicMonitor = require('../utils/musicMonitor');
const config       = require('../config');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member?.user?.bot) return;

    const name    = member.user.username.toLowerCase();
    const isMusic = config.musicBotKeywords.some(k => name.includes(k));
    if (!isMusic) return;

    clearTimeout(client._musicRefreshTimer);
    client._musicRefreshTimer = setTimeout(() => {
      musicMonitor.updateMusicMonitor(client);
    }, 2000);
  },
};
