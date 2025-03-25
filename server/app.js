const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config/config');
const schedulerService = require('./services/schedulerService');
const s3Service = require('./services/s3Service');
const tokenRefreshService = require('./services/tokenRefreshService');

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Роуты API
app.use('/api/tasks', require('./routes/api/tasks'));
app.use('/api/posts', require('./routes/api/posts'));

// Добавляем новый маршрут для настроек
app.use('/api/settings', require('./routes/api/settings'));

// Добавляем новый маршрут для шаблонов фильтров
app.use('/api/filter-templates', require('./routes/api/filterTemplates'));

// Добавляем маршрут для публикации постов
app.use('/api/publishing', require('./routes/api/publishing'));

// Добавляем маршрут для VK Auth
app.use('/api/vk-auth', require('./routes/api/vkAuth'));

// API Routes
app.use('/api/vk', require('./routes/api/vk')); // Add this line
app.use('/api/publish-tasks', require('./routes/api/publishTasks'));

// Обслуживание статических файлов React в production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// Подключение к MongoDB
mongoose.connect(config.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('MongoDB connected');
    
    // Запуск планировщиков
    schedulerService.init();
    tokenRefreshService.init();
    
    // Запуск сервера
    const PORT = config.port || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
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
