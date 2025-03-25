const path = require('path');

// VK API configuration
const vkConfig = {
  appId: process.env.VK_APP_ID || '52750600',
  appSecret: process.env.VK_APP_SECRET || '6IXAcrW9vfarh8sncrTi',
  redirectUri: process.env.VK_REDIRECT_URI || 'https://krazu-group.tech/api/vk-auth/callback',
  token: process.env.VK_TOKEN || '8642adf18642adf18642adf16f856644f9886428642adf1e100516a63045e8341fbf21a', // Use service token as fallback
  apiVersion: '5.131',
  userId: process.env.VK_USER_ID || '123456789' // Add a default user ID (replace with your actual user ID)
};

module.exports = {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/vk_scraper',
  vk: vkConfig,
  vkApi: {
    // ID приложения ВКонтакте
    appId: 52750600,
    
    // Секретный ключ приложения ВКонтакте
    appSecret: "6IXAcrW9vfarh8sncrTi",
    
    // Сервисный ключ (если используется)
    serviceToken: "8642adf18642adf18642adf16f856644f9886428642adf1e100516a63045e8341fbf21a",
    
    // Версия API
    version: '5.131'
  },
  ytdlp: {
    path: path.join(__dirname, '../yt-dlp.exe'), // Используем путь относительно папки config
    // Используем абсолютный путь для директории загрузок
    downloadDir: path.resolve(__dirname, '../downloads')
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'vk-media'
  },
  downloadMedia: process.env.DOWNLOAD_MEDIA === 'true'
};
