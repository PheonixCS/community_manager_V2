const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Схема для медиа-фильтров
const MediaFilterSchema = new Schema({
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: -1 // -1 означает "без ограничений"
  }
}, { _id: false });

// Схема для всех типов медиа
const MediaFiltersSchema = new Schema({
  photos: {
    type: MediaFilterSchema,
    default: () => ({ min: 0, max: -1 })
  },
  videos: {
    type: MediaFilterSchema,
    default: () => ({ min: 0, max: -1 })
  },
  documents: {
    type: MediaFilterSchema,
    default: () => ({ min: 0, max: -1 })
  },
  audio: {
    type: MediaFilterSchema,
    default: () => ({ min: 0, max: -1 })
  }
}, { _id: false });

const FilterTemplateSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Медиа-фильтры
  mediaFilters: {
    type: MediaFiltersSchema,
    default: () => ({
      photos: { min: 0, max: -1 },
      videos: { min: 0, max: -1 },
      documents: { min: 0, max: -1 },
      audio: { min: 0, max: -1 }
    })
  },
  // Проверка наличия внешних ссылок
  skipExternalLinks: {
    type: Boolean,
    default: false
  },
  // Поиск текста в посте
  containsText: {
    type: String,
    default: ''
  },
  // Метаданные
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FilterTemplate', FilterTemplateSchema);
