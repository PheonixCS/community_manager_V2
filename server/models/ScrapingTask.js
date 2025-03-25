const mongoose = require('mongoose');

const ScrapingTaskSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  communities: [{
    value: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['id', 'domain'],
      default: 'id'
    }
  }],
  filters: {
    count: {
      type: Number,
      default: 100
    },
    offset: {
      type: Number,
      default: 0
    },
    filter: {
      type: String,
      enum: ['owner', 'others', 'all', 'postponed', 'suggests'],
      default: 'all'
    },
    extended: {
      type: Boolean,
      default: 1
    },
    // Заменяем dateFrom и dateTo на depth
    depth: {
      type: Number,
      default: 24, // По умолчанию берем посты за последние 24 часа
      min: 1,
      max: 720 // Максимум 30 дней (720 часов)
    },
    containsText: String,
    skipExternalLinks: {
      type: Boolean,
      default: false
    }
    // Удалены фильтры minLikes, minComments, minReposts, minViews
  },
  filterTemplates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FilterTemplate'
  }],
  schedule: {
    interval: {
      type: Number, // Интервал в минутах
      default: 60
    },
    active: {
      type: Boolean,
      default: true
    },
    lastRun: {
      type: Date
    },
    nextRun: {
      type: Date
    }
  },
  statistics: {
    totalPosts: {
      type: Number,
      default: 0
    },
    newPostsLastRun: {
      type: Number,
      default: 0
    },
    updatedPostsLastRun: {
      type: Number,
      default: 0
    },
    lastRunAt: {
      type: Date
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('ScrapingTask', ScrapingTaskSchema);
