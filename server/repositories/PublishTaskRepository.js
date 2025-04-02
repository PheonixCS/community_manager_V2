const BaseRepository = require('./BaseRepository');
const PublishTask = require('../models/PublishTask');
const PublishHistory = require('../models/PublishHistory');
const Post = require('../models/Post');
const parser = require('cron-parser').default || require('cron-parser');
class PublishTaskRepository extends BaseRepository {
  constructor() {
    super(PublishTask);
  }

  /**
   * Найти задачи публикации по расписанию, которые должны быть выполнены
   * @returns {Promise<Document[]>} Массив задач для выполнения
   */
  async findScheduledTasksDueForExecution() {
    const now = new Date();
    return await this.findAll({
      type: 'schedule',
      'schedule.active': true,
      'statistics.nextExecutionAt': { $lte: now }
    }, {
      populate: 'scrapingTasks'
    });
  }

  /**
   * Найти разовые задачи публикации, которые должны быть выполнены
   * @returns {Promise<Document[]>} Массив разовых задач для выполнения
   */
  async findOneTimeTasksDueForExecution() {
    const now = new Date();
    return await this.findAll({
      type: 'one_time',
      'oneTime.executed': false,
      'oneTime.scheduledAt': { $lte: now }
    }, {
      populate: 'scrapingTasks'
    });
  }

  /**
   * Обновить статистику задачи после выполнения
   * @param {string} taskId - ID задачи
   * @param {Object} stats - Статистика выполнения
   * @returns {Promise<Document|null>} Обновленная задача
   */
  async updateTaskStatistics(taskId, stats) {
    const { successful = 0, failed = 0, nextExecutionAt = null } = stats;
    
    const task = await this.findById(taskId);
    if (!task) return null;
    
    const updateData = {
      'statistics.lastExecutedAt': new Date(),
      $inc: {
        'statistics.totalExecutions': 1,
        'statistics.successfulPublications': successful,
        'statistics.failedPublications': failed
      }
    };
    
    // Обновляем счетчик выполнений для периодической задачи
    if (task.type === 'schedule') {
      updateData.$inc['schedule.executionCount'] = 1;
      
      // Добавляем дату следующего запуска, если она предоставлена
      if (nextExecutionAt) {
        updateData['statistics.nextExecutionAt'] = nextExecutionAt;
      }
      
      // Проверяем, не достигли ли мы лимита выполнений
      const newExecutionCount = (task.schedule.executionCount || 0) + 1;
      if (task.schedule.executionLimit > 0 && newExecutionCount >= task.schedule.executionLimit) {
        updateData['schedule.active'] = false;
      }
    } else if (task.type === 'one_time') {
      // Отмечаем разовую задачу как выполненную
      updateData['oneTime.executed'] = true;
    }
    
    return await this.update(taskId, updateData);
  }

  /**
   * Сохранение истории публикации
   * @param {Object} historyData - Данные истории публикации
   * @returns {Promise<Document>} Сохраненная запись истории
   */
  async savePublishHistory(historyData) {
    try {
      // Ensure there's a status field
      if (!historyData.status) {
        historyData.status = 'success';
      }
      
      // If status is failed but no targetPostId/Url, make sure that's handled
      if (historyData.status === 'failed') {
        // These fields are optional for failed statuses
        if (!historyData.targetPostId) {
          historyData.targetPostId = 'failed_publish';
        }
      }
      
      const history = new PublishHistory(historyData);
      return await history.save();
    } catch (error) {
      console.error('Error saving publish history:', error);
      // Instead of throwing, return a minimal object for failure tracking
      return {
        _id: 'error',
        status: 'failed',
        errorMessage: `Failed to save history: ${error.message}`
      };
    }
  }

  /**
   * Получить историю публикаций для задачи
   * @param {string} taskId - ID задачи публикации
   * @returns {Promise<Document[]>} Массив записей истории
   */
  async getTaskPublishHistory(taskId) {
    return await PublishHistory.find({ publishTaskId: taskId })
      .sort({ publishedAt: -1 });
  }

  /**
   * Получить историю публикаций для поста
   * @param {string} postId - MongoDB ID поста
   * @returns {Promise<Document[]>} Массив записей истории
   */
  async getPostPublishHistory(postId) {
    return await PublishHistory.find({ postId })
      .sort({ publishedAt: -1 });
  }

  /**
   * Рассчитать следующее время выполнения для задачи по расписанию
   * @param {string} cronExpression - Выражение cron
   * @returns {Promise<Date|null>} Дата следующего запуска или null в случае ошибки
   */
  async calculateNextExecutionTime(cronExpression) {
    try {
      console.log(typeof parser.parseExpression); 
      const interval = parser.parse(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      console.error('Error parsing cron expression:', error);
      return null;
    }
  }

  /**
   * Найти лучшие посты для публикации из заданий скрапинга, которые еще не были опубликованы в указанное сообщество
   * @param {Array<string>} scrapingTaskIds - Массив ID заданий скрапинга
   * @param {number} limit - Максимальное количество постов
   * @param {number} minViewRate - Минимальный рейтинг просмотров
   * @returns {Promise<Array<Document>>} Массив постов для публикации
   */
  async findBestPostsForPublishing(scrapingTaskIds, limit = 1, minViewRate = 0, targetGroupId) {
    try {
      // 1. Получаем ID постов, которые уже были опубликованы в это сообщество
      const publishedHistory = await PublishHistory.find({
        status: 'success',
        targetGroupId: targetGroupId
      }).select('postId');
      
      // Извлекаем ID опубликованных постов
      const publishedPostIds = publishedHistory.map(h => h.postId);
      
      console.log(`Found ${publishedPostIds.length} posts already published in target group ${targetGroupId}`);
      
      let posts = [];
      let excludedPostIds = new Set(publishedPostIds); // Используем Set для быстрого поиска

      while (posts.length < limit) {
        // Формируем запрос
        const query = {
          taskId: { $in: scrapingTaskIds },
          viewRate: { $gte: minViewRate },
          _id: { $nin: Array.from(excludedPostIds) } // Исключаем уже исключенные посты
        };

        // Получаем неопубликованные в это сообщество посты, отсортированные по рейтингу
        const fetchedPosts = await Post.find(query)
          .sort({ viewRate: -1 })
          .limit(limit - posts.length); // Ограничиваем количество запрашиваемых постов

        // Проверяем, какие посты соответствуют условиям
        const validPosts = fetchedPosts.filter(post => {
          const downloadedPhotosCount = post.mediaDownloads.filter(media => media.type === 'photo').length;
          const downloadedVideosCount = post.mediaDownloads.filter(media => media.type === 'video').length;
          const attachedPhotosCount = post.attachments.filter(attachment => attachment.type === 'photo').length;
          const attachedVideosCount = post.attachments.filter(attachment => attachment.type === 'video').length;
          console.log(`Post ${post._id}: downloadedPhotosCount=${downloadedPhotosCount}, attachedPhotosCount=${attachedPhotosCount}, downloadedVideosCount=${downloadedVideosCount}, attachedVideosCount=${attachedVideosCount}`);
          return downloadedPhotosCount === attachedPhotosCount && downloadedVideosCount === attachedVideosCount;
        });

        // Добавляем валидные посты в общий массив
        posts = posts.concat(validPosts);

        // Если валидных постов меньше, чем нужно, добавляем их ID в исключения
        if (validPosts.length < limit - posts.length) {
          fetchedPosts.forEach(post => excludedPostIds.add(post._id));
        }

        // Если больше нет постов для обработки, выходим из цикла
        if (fetchedPosts.length === 0) {
          break;
        }
      }

// Теперь у вас есть массив posts с нужными постами

      console.log(`Found ${posts.length} unpublished posts for target group ${targetGroupId}`);
      
      return posts;
    } catch (error) {
      console.error('Error finding posts for publishing:', error);
      return [];
    }
  }
}

module.exports = new PublishTaskRepository();
