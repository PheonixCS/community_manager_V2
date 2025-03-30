const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  // VK ID поста
  vkId: { 
    type: String, 
    required: true 
  },
  // Используем то же поле для postId
  postId: { 
    type: String, 
    required: true 
  },
  // Сообщество
  communityId: { 
    type: String, 
    ref: 'Community', 
    required: true 
  },
  // Задача, которая добавила пост
  taskId: { 
    type: Schema.Types.ObjectId, 
    ref: 'ScrapingTask',
    required: true 
  },
  // Текст поста
  text: { 
    type: String, 
    default: '' 
  },
  // Дата публикации
  date: { 
    type: Date, 
    required: true 
  },
  // Статистика
  likes: { 
    type: Number, 
    default: 0 
  },
  reposts: { 
    type: Number, 
    default: 0 
  },
  views: { 
    type: Number, 
    default: 0 
  },
  // Вложения из VK API
  attachments: { 
    type: Array, 
    default: [] 
  },
  // Информация о скачанных медиа (общий формат)
  mediaDownloads: [{
    type: { type: String, enum: ['photo', 'video', 'doc', 'audio'] },
    mediaId: String,
    s3Url: String,
    s3Key: String,
    downloadedAt: Date
  }],
  // Для обратной совместимости (специфично для видео)
  downloadedVideos: [{
    videoId: String,
    s3Url: String,
    s3Key: String,
    fileName: String,
    title: String,
    downloadedAt: Date
  }],
  // Метаданные
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  // Добавляем поля для рейтинга
  viewRate: { 
    type: Number, 
    default: 0 
  }, // Рейтинг в просмотрах в секунду
  
  isCarousel: {
    type: Boolean,
    default: false
  } // Флаг карусели
});

// Индексы для быстрого поиска
PostSchema.index({ vkId: 1, communityId: 1 }, { unique: true });
PostSchema.index({ postId: 1, communityId: 1 }, { unique: true });
PostSchema.index({ taskId: 1 });
PostSchema.index({ date: -1 });

// Добавляем метод для расчета рейтинга
PostSchema.methods.calculateViewRate = function() {
  if (!this.views || !this.date) {
    return 0;
  }
  
  const publishedAt = new Date(this.date);
  const currentTime = new Date();
  const secondsElapsed = Math.max(1, Math.floor((currentTime - publishedAt) / 1000)); // Защита от деления на ноль
  
  return parseFloat((this.views / secondsElapsed).toFixed(6)); // 6 знаков после запятой
};

module.exports = mongoose.model('Post', PostSchema);
