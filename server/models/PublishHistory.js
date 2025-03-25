const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PublishHistorySchema = new Schema({
  // Идентификатор оригинального поста в группе-источнике
  sourcePostId: {
    type: String,
    required: true
  },
  
  // MongoDB ID поста (для связи с моделью Post)
  postId: {
    type: Schema.Types.ObjectId,
    ref: 'Post'
  },
  
  // ID сообщества-источника
  sourceGroupId: {
    type: String,
    required: true
  },
  
  // ID сообщества, куда опубликовали пост
  targetGroupId: {
    type: String,
    required: true
  },
  
  // ID опубликованного поста в целевом сообществе
  targetPostId: {
    type: String
  },
  
  // URL опубликованного поста
  targetPostUrl: {
    type: String
  },
  
  // Дата публикации
  publishedAt: {
    type: Date,
    default: Date.now
  },
  
  // Задача публикации, которая создала запись
  publishTaskId: {
    type: Schema.Types.ObjectId,
    ref: 'PublishTask'
  },
  
  // Статус публикации: success, failed
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  
  // Сообщение об ошибке (если статус failed)
  errorMessage: {
    type: String
  }
});

// Индексы для оптимизации запросов
PublishHistorySchema.index({ sourcePostId: 1, targetGroupId: 1 });
PublishHistorySchema.index({ postId: 1 });
PublishHistorySchema.index({ publishTaskId: 1 });
PublishHistorySchema.index({ publishedAt: -1 });

module.exports = mongoose.model('PublishHistory', PublishHistorySchema);
