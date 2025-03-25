const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PublishTaskSchema = new Schema({
  // Название задачи
  name: {
    type: String,
    required: true
  },
  
  // Описание задачи
  description: {
    type: String
  },
  
  // Тип задачи: schedule (по расписанию) или one_time (разовая)
  type: {
    type: String,
    enum: ['schedule', 'one_time'],
    default: 'one_time'
  },
  
  // Целевые сообщества для публикации
  targetGroups: [{
    // ID группы ВКонтакте (со знаком - для групп)
    groupId: {
      type: String,
      required: true
    },
    // Имя группы (для отображения)
    name: String
  }],
  
  // Связь с задачами скрапинга - источники постов
  scrapingTasks: [{
    type: Schema.Types.ObjectId,
    ref: 'ScrapingTask'
  }],
  
  // Максимальное количество постов для публикации за один запуск
  postsPerExecution: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  
  // Минимальный рейтинг постов для публикации
  minViewRate: {
    type: Number,
    default: 0
  },
  
  // Флаг использования генератора контента
  useContentGenerator: {
    type: Boolean,
    default: false
  },
  
  // Настройки генерации контента (если useContentGenerator = true)
  contentGeneratorSettings: {
    // ID генератора контента
    generatorId: {
      type: String,
      required: function() { return this.useContentGenerator; }
    },
    // Дополнительные параметры для генератора
    params: Schema.Types.Mixed
  },
  
  // Настройки расписания для type = schedule
  schedule: {
    // Выражение cron для расписания (например, "0 9 * * 1-5" - каждый будний день в 9:00)
    cronExpression: String,
    // Количество выполнений (0 - бесконечное)
    executionLimit: {
      type: Number,
      default: 0
    },
    // Счетчик выполнений
    executionCount: {
      type: Number,
      default: 0
    },
    // Флаг активности задачи
    active: {
      type: Boolean,
      default: true
    }
  },
  
  // Настройки для разовой публикации (type = one_time)
  oneTime: {
    // Запланированная дата и время публикации
    scheduledAt: Date,
    // Флаг выполнения
    executed: {
      type: Boolean,
      default: false
    }
  },
  
  // Опции публикации
  publishOptions: {
    // Публикация от имени группы (true) или от имени пользователя (false)
    fromGroup: {
      type: Boolean,
      default: true
    },
    // Закрепить пост
    pinned: {
      type: Boolean,
      default: false
    },
    // Пометить как рекламу
    markedAsAds: {
      type: Boolean,
      default: false
    }
  },
  
  // Настройки кастомизации постов
  postCustomization: {
    // Добавить дополнительный текст к посту
    addText: {
      // Флаг активации
      enabled: {
        type: Boolean,
        default: false
      },
      // Позиция текста (вначале/вконце)
      position: {
        type: String,
        enum: ['before', 'after'],
        default: 'after'
      },
      // Сам текст
      text: {
        type: String,
        default: ''
      }
    },
    // Добавить изображение к посту
    addImage: {
      // Флаг активации
      enabled: {
        type: Boolean,
        default: false
      },
      // URL изображения или S3-ключ
      imageUrl: {
        type: String,
        default: ''
      }
    },
    // Добавить хэштеги
    addHashtags: {
      // Флаг активации
      enabled: {
        type: Boolean,
        default: false
      },
      // Список хэштегов
      hashtags: {
        type: String,
        default: ''
      }
    },
    // Добавить ссылку на источник
    addSourceLink: {
      // Флаг активации
      enabled: {
        type: Boolean,
        default: false
      },
      // Текст для ссылки
      text: {
        type: String,
        default: 'Источник: '
      }
    },
    // Добавить подпись снизу (например, авторство)
    addSignature: {
      // Флаг активации
      enabled: {
        type: Boolean,
        default: false
      },
      // Текст подписи
      text: {
        type: String,
        default: ''
      }
    }
  },
  
  // Статистика
  statistics: {
    // Общее количество выполнений
    totalExecutions: {
      type: Number,
      default: 0
    },
    // Количество успешных публикаций
    successfulPublications: {
      type: Number,
      default: 0
    },
    // Количество неудачных публикаций
    failedPublications: {
      type: Number,
      default: 0
    },
    // Дата последнего запуска
    lastExecutedAt: Date,
    // Дата следующего запуска (для type = schedule)
    nextExecutionAt: Date
  },
  
  // Метаданные
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: String // ID пользователя или система
  }
}, { timestamps: true });

// Индексы для быстрого поиска
PublishTaskSchema.index({ type: 1 });
PublishTaskSchema.index({ 'schedule.active': 1, 'statistics.nextExecutionAt': 1 });
PublishTaskSchema.index({ 'oneTime.scheduledAt': 1, 'oneTime.executed': 1 });

module.exports = mongoose.model('PublishTask', PublishTaskSchema);
