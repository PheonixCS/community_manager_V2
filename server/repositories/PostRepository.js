const BaseRepository = require('./BaseRepository');
const Post = require('../models/Post');

class PostRepository extends BaseRepository {
  constructor() {
    super(Post);
  }

  /**
   * Получить топ постов по рейтингу
   * @param {Object} filter - Фильтры для поиска
   * @param {Object} options - Опции (лимит, пропуск)
   * @returns {Promise<Document[]>} Массив постов
   */
  async getTopRatedPosts(filter = {}, options = {}) {
    const { limit = 20, skip = 0 } = options;
    
    return await this.model.find(filter)
      .sort({ viewRate: -1 })
      .skip(skip)
      .limit(limit);
  }

  /**
   * Получить статистику по постам
   * @returns {Promise<Object>} Объект со статистикой
   */
  async getStatistics() {
    const totalPosts = await this.count();
    
    const metrics = await this.model.aggregate([
      {
        $group: {
          _id: null,
          totalLikes: { $sum: '$likes' },
          totalComments: { $sum: '$comments' },
          totalReposts: { $sum: '$reposts' },
          totalViews: { $sum: '$views' },
          avgLikes: { $avg: '$likes' },
          avgComments: { $avg: '$comments' },
          avgReposts: { $avg: '$reposts' },
          avgViews: { $avg: '$views' },
          avgViewRate: { $avg: '$viewRate' },
          maxViewRate: { $max: '$viewRate' },
          minViewRate: { $min: '$viewRate' },
          totalMediaFiles: {
            $sum: {
              $add: [
                { $size: { $ifNull: ['$mediaDownloads', []] } },
                { $size: { $ifNull: ['$downloadedVideos', []] } }
              ]
            }
          }
        }
      }
    ]);

    const communityCounts = await this.model.aggregate([
      {
        $group: {
          _id: '$communityId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const postsByDay = await this.model.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    return {
      totalPosts,
      metrics: metrics[0] || {},
      communityCounts,
      postsByDay
    };
  }

  /**
   * Найти посты для конкретного сообщества
   * @param {string} communityId - ID сообщества
   * @param {Object} options - Опции (сортировка, пагинация)
   * @returns {Promise<Document[]>} Массив постов
   */
  async findByCommunity(communityId, options = {}) {
    return await this.findAll({ communityId }, options);
  }

  /**
   * Удалить все посты и обновить статистику заданий
   * @returns {Promise<Object>} Результат операции
   */
  async deleteAll() {
    // Получение информации о постах до удаления для статистики
    const postsCount = await this.count();
    
    // Получение уникальных taskId для обновления статистики заданий
    const taskIds = await this.model.distinct('taskId');
    
    // Удаление всех постов
    await this.model.deleteMany({});
    
    return {
      deletedPosts: postsCount,
      taskIds,
      resetStatsCount: taskIds.length
    };
  }

  /**
   * Обновить рейтинг для всех постов
   * @returns {Promise<number>} Количество обновленных постов
   */
  async updateAllViewRates() {
    const posts = await this.findAll();
    let updatedCount = 0;
    
    for (const post of posts) {
      if (post.date && post.views) {
        post.viewRate = post.calculateViewRate();
        await post.save();
        updatedCount++;
      }
    }
    
    return updatedCount;
  }
}

module.exports = new PostRepository();
