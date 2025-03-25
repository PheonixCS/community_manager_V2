const BaseRepository = require('./BaseRepository');
const Task = require('../models/ScrapingTask');

class TaskRepository extends BaseRepository {
  constructor() {
    super(Task);
  }

  /**
   * Найти активные задачи, которые должны быть запущены
   * @returns {Promise<Document[]>} Массив активных задач
   */
  async findActiveTasks() {
    const now = new Date();
    return await this.findAll({
      'schedule.active': true,
      $or: [
        { 'schedule.nextRun': { $lte: now } },
        { 'schedule.nextRun': { $exists: false } }
      ]
    }, {
      populate: [
        { path: 'communities' },
        { path: 'filterTemplates' }
      ]
    });
  }

  /**
   * Обновить статистику задачи после выполнения
   * @param {string} id - ID задачи
   * @param {Object} stats - Новая статистика
   * @returns {Promise<Document|null>} Обновленная задача или null
   */
  async updateTaskStatistics(id, stats) {
    const task = await this.findById(id);
    if (!task) return null;
    
    // Обновляем статистику
    const currentStats = task.statistics || {};
    const totalPosts = (currentStats.totalPosts || 0) + (stats.newPostsCount || 0);
    
    // Рассчитываем следующее время запуска
    const now = new Date();
    const nextRun = new Date(now.getTime() + (task.schedule.interval * 60 * 1000));
    
    return await this.update(id, {
      'schedule.lastRun': now,
      'schedule.nextRun': nextRun,
      status: 'completed',
      'statistics.totalPosts': totalPosts,
      'statistics.newPostsLastRun': stats.newPostsCount || 0,
      'statistics.updatedPostsLastRun': stats.updatedPostsCount || 0,
      'statistics.lastRunAt': now
    });
  }

  /**
   * Выполнить задачу немедленно и обновить ее расписание
   * @param {string} id - ID задачи
   * @returns {Promise<Document|null>} Обновленная задача или null
   */
  async executeTaskNow(id) {
    const task = await this.findById(id);
    if (!task) return null;
    
    // Обновляем только расписание (запуск задачи будет выполнен через сервис)
    const now = new Date();
    return await this.update(id, {
      'schedule.nextRun': now
    });
  }

  /**
   * Переключить активность задачи
   * @param {string} id - ID задачи
   * @returns {Promise<Document|null>} Обновленная задача или null
   */
  async toggleTaskActive(id) {
    const task = await this.findById(id);
    if (!task) return null;
    
    const isActive = !task.schedule.active;
    
    // Рассчитываем следующее время запуска, если задача активирована
    let nextRun = task.schedule.nextRun;
    if (isActive) {
      const now = new Date();
      nextRun = new Date(now.getTime() + (task.schedule.interval * 60 * 1000));
    }
    
    return await this.update(id, {
      'schedule.active': isActive,
      'schedule.nextRun': nextRun
    });
  }

  /**
   * Сбросить статистику для списка задач
   * @param {string[]} taskIds - Массив ID задач
   * @returns {Promise<number>} Количество обновленных задач
   */
  async resetStatistics(taskIds) {
    const result = await Task.updateMany(
      { _id: { $in: taskIds } },
      {
        $set: {
          'statistics.totalPosts': 0,
          'statistics.newPostsLastRun': 0,
          'statistics.updatedPostsLastRun': 0
        }
      }
    );
    
    return result.nModified || 0;
  }
}

module.exports = new TaskRepository();
