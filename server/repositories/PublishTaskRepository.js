const BaseRepository = require('./BaseRepository');
const PublishTask = require('../models/PublishTask');
const PublishHistory = require('../models/PublishHistory');
const Post = require('../models/Post');

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
   * Сохранить историю публикации
   * @param {Object} historyData - Данные для истории публикации
   * @returns {Promise<Document>} Созданная запись истории
   */
  async savePublishHistory(historyData) {
    return await PublishHistory.create(historyData);
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
      const parser = require('cron-parser');
      const interval = parser.parseExpression(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      console.error('Error parsing cron expression:', error);
      return null;
    }
  }

  /**
   * Найти лучшие посты для публикации из заданий скрапинга
   * @param {Array<string>} scrapingTaskIds - Массив ID заданий скрапинга
   * @param {number} limit - Максимальное количество постов
   * @param {number} minViewRate - Минимальный рейтинг просмотров
   * @returns {Promise<Array<Document>>} Массив постов для публикации
   */
  async findBestPostsForPublishing(scrapingTaskIds, limit = 1, minViewRate = 0) {
    // Получаем все посты из заданий скрапинга
    const posts = await Post.find({
      taskId: { $in: scrapingTaskIds },
      viewRate: { $gte: minViewRate }
    }).sort({ viewRate: -1 }).limit(limit);
    
    // Фильтруем посты, которые уже были опубликованы
    const unpublishedPosts = [];
    
    for (const post of posts) {
      // Проверяем, есть ли запись в истории публикаций для этого поста
      const publishHistory = await PublishHistory.findOne({ postId: post._id });
      
      if (!publishHistory) {
        unpublishedPosts.push(post);
        
        // Если достигли нужного количества постов, прекращаем поиск
        if (unpublishedPosts.length >= limit) {
          break;
        }
      }
    }
    
    return unpublishedPosts;
  }
}

module.exports = new PublishTaskRepository();
