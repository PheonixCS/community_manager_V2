const os = require('os');
const path = require('path');
const isWindows = os.platform() === 'win32';
// VK API configuration
const vkConfig = {
  appId: process.env.VK_APP_ID || '52750600',
  appSecret: process.env.VK_APP_SECRET || '6IXAcrW9vfarh8sncrTi',
  redirectUri: process.env.VK_REDIRECT_URI || 'https://krazu-group.tech/api/vk-auth/callback',
  token: process.env.VK_TOKEN || '8642adf18642adf18642adf16f856644f9886428642adf1e100516a63045e8341fbf21a', // Use service token as fallback
  apiVersion: '5.131',
  userId: process.env.VK_USER_ID || '123456789', // Add a default user ID (replace with your actual user ID)
  // VK ID specific endpoints
  endpoints: {
    authorize: 'https://id.vk.com/authorize', // VK ID auth endpoint
    token: 'https://oauth.vk.com/access_token', // OAuth token endpoint
    refresh: 'https://oauth.vk.com/access_token' // Same endpoint for refresh
  },
  // Add a list of scope names to their bit values for conversion
  scopeMappings: {
    'notify': 1,
    'friends': 2,
    'photos': 4,
    'audio': 8,
    'video': 16,
    'stories': 32,
    'pages': 64,
    'status': 128,
    'notes': 256,
    'messages': 512,
    'wall': 1024,
    'ads': 2048,
    'offline': 4096,
    'docs': 8192,
    'groups': 16384,
    'notifications': 32768,
    'stats': 65536,
    'email': 131072,
    'market': 262144,
    'phone': 524288
  }
};

module.exports = {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGO_URI || 'mongodb://vkapp:3dbU24GfKmhw8hnLV8Ob@127.0.0.1:27017/vk_scraper',
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
    path: isWindows ? path.join(__dirname, '../yt-dlp.exe') : path.join(__dirname, '../yt-dlp'), // Используем путь относительно папки config
    // Используем абсолютный путь для директории загрузок
    downloadDir: path.resolve(__dirname, '../downloads')
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'miniocodex',
    secretKey: process.env.S3_SECRET_KEY || 's8#K$pL2@q9!zR5%fXmY7',
    bucket: process.env.S3_BUCKET || 'vk-media',
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || 'http://ahuyang.com:9000',

  },
  downloadMedia: process.env.DOWNLOAD_MEDIA === 'true'
};
