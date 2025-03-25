const path = require('path');

module.exports = {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/vk_scraper',
  vk: {
    serviceKey: '', // Будем брать из базы
    apiVersion: process.env.VK_API_VERSION || '5.131'
  },
  vkApi: {
    // ID приложения ВКонтакте
    appId: process.env.VK_APP_ID,
    
    // Секретный ключ приложения ВКонтакте
    appSecret: process.env.VK_APP_SECRET,
    
    // Сервисный ключ (если используется)
    serviceToken: process.env.VK_SERVICE_TOKEN,
    
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
