import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Instagram Downloader Service running on port ${PORT}`);
  console.log(`🌐 Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`🤖 Instagram Bot Username: @${process.env.BOT_USERNAME || 'hqdownloaderbot'}`);
  console.log(`📡 Webhook Endpoint: /webhook`);
  console.log(`📦 Headless Storage: Telegram Channel ${process.env.TELEGRAM_STORAGE_CHANNEL_ID || '(Not configured yet)'}`);
  console.log('====================================================');
});
