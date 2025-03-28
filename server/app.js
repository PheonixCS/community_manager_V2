const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config/config');
const schedulerService = require('./services/schedulerService');
const s3Service = require('./services/s3Service');
const tokenRefreshService = require('./services/tokenRefreshService');
const cleanupService = require('./services/cleanupService');

// Создаём все необходимые директории при запуске
const downloadDir = path.resolve(__dirname, 'downloads');
fs.ensureDirSync(downloadDir);

// Создаем структуру директорий для разных типов медиа
const mediaDirs = ['photos', 'videos', 'documents', 'audio'];
mediaDirs.forEach(dir => {
  fs.ensureDirSync(path.join(downloadDir, dir));
});

// Создаём директорию для скачивания видео, если она не существует
fs.ensureDirSync(path.resolve(__dirname, config.ytdlp.downloadDir));

// Проверяем доступность S3 хранилища
(async () => {
  try {
    await s3Service.ensureBucketExists();
    console.log('S3 bucket check completed successfully');
  } catch (error) {
    console.error('Error checking S3 bucket:', error);
  }
})();

const app = express();

// 1. Middleware - ДОЛЖНЫ БЫТЬ В НАЧАЛЕ
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Добавим логирование запросов для отладки
app.use((req, res, next) => {
  if (req.path !== '/api/status') { // не логируем частые проверки статуса
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// 2. Простой маршрут для проверки статуса API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// 3. Роуты API
app.use('/api/tasks', require('./routes/api/tasks'));
app.use('/api/posts', require('./routes/api/posts'));
app.use('/api/settings', require('./routes/api/settings'));
app.use('/api/filter-templates', require('./routes/api/filterTemplates'));
app.use('/api/publishing', require('./routes/api/publishing'));
app.use('/api/vk-auth', require('./routes/api/vkAuth'));
app.use('/api/vk', require('./routes/api/vk'));
app.use('/api/publish-tasks', require('./routes/api/publishTasks'));
app.use('/api/media', require('./routes/mediaRoutes'));
app.use('/api/cleanup', require('./routes/api/cleanup'));

// 4. Обслуживание статических файлов React в production - ПОСЛЕ API маршрутов!
if (process.env.NODE_ENV === 'production' || true) {
  console.log('Serving static React files from:', path.join(__dirname, '../client/build'));
  // Указываем Express раздавать файлы из папки build клиента
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Для любых запросов, не относящихся к API, возвращаем React-приложение
  app.get('*', (req, res) => {
    console.log('Serving React app for route:', req.originalUrl);
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// 5. Обработка ошибок - ВСЕГДА В КОНЦЕ
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Подключение к MongoDB
mongoose.set('strictQuery', false); // Убираем предупреждение
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  directConnection: true,
  family: 4  // Принудительно использовать IPv4
})
  .then((connection) => {
    console.log(`MongoDB Connected: ${connection.connection.host}`);
    
    // Initialize services that require database connection
    cleanupService.init().catch(err => {
      console.error('Error initializing cleanup service:', err);
    });
    
    // Запуск планировщиков
    schedulerService.init();
    tokenRefreshService.init();
    
    // Запуск сервера
    const PORT = config.port || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Обработка сигналов завершения
process.on('SIGINT', () => {
  schedulerService.stop();
  tokenRefreshService.stop();
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});