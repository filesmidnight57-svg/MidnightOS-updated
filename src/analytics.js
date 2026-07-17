const axios = require('axios');
const { getAccessToken } = require('./youtubeOAuth');
const { update, sanitize } = require('./utils/store');
async function refreshAnalytics() {
  const snapshot = { refreshedAt: new Date().toISOString(), youtube: { configured: false }, facebook: { configured: false }, instagram: { configured: false } };
  try {
    if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
      snapshot.youtube.configured = true;
      const token = await getAccessToken();
      const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', { params: { part: 'statistics,snippet', mine: true }, headers: { Authorization: `Bearer ${token}` }, timeout: 20000 });
      const channel = response.data.items?.[0];
      if (channel) snapshot.youtube = { configured: true, channelId: channel.id, name: channel.snippet?.title, subscribers: Number(channel.statistics?.subscriberCount), totalViews: Number(channel.statistics?.viewCount), videoCount: Number(channel.statistics?.videoCount), refreshedAt: snapshot.refreshedAt };
    }
  } catch (error) { snapshot.youtube.error = sanitize(error.message); }
  update((data) => { data.analytics = snapshot; });
  return snapshot;
}
module.exports = { refreshAnalytics };
