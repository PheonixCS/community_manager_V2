const express = require('express');
const router = express.Router();
const Post = require('../../models/Post');
const postService = require('../../services/postService');
const videoDownloadService = require('../../services/videoDownloadService');

// Получить все посты с пагинацией и фильтрацией
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Определяем параметры сортировки
    const sortField = req.query.sortBy || 'publishedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder };
    
    // Фильтры
    const filter = {};
    
    if (req.query.communityId) {
      filter.communityId = req.query.communityId;
    }
    
    if (req.query.dateFrom) {
      filter.publishedAt = { ...filter.publishedAt, $gte: new Date(req.query.dateFrom) };
    }
    
    if (req.query.dateTo) {
      filter.publishedAt = { ...filter.publishedAt, $lte: new Date(req.query.dateTo) };
    }
    
    if (req.query.search) {
      filter.content = { $regex: req.query.search, $options: 'i' };
    }

    // Дополнительные фильтры по рейтингу
    if (req.query.minViewRate) {
      filter.viewRate = { ...filter.viewRate, $gte: parseFloat(req.query.minViewRate) };
    }
    
    if (req.query.maxViewRate) {
      filter.viewRate = { ...filter.viewRate, $lte: parseFloat(req.query.maxViewRate) };
    }

    // Получаем все посты с применением сортировки
    const allPosts = await Post.find(filter).sort(sort);
    
    // Фильтрация по количеству вложений
    let filteredPosts = allPosts;
    if (req.query.minAttachments || req.query.maxAttachments) {
      filteredPosts = allPosts.filter(post => {
        const attachmentsCount = post.attachments?.length || 0;
        const minOk = !req.query.minAttachments || attachmentsCount >= parseInt(req.query.minAttachments);
        const maxOk = !req.query.maxAttachments || attachmentsCount <= parseInt(req.query.maxAttachments);
        return minOk && maxOk;
      });
    }
    
    // Применяем пагинацию к отфильтрованным постам
    const paginatedPosts = filteredPosts.slice(skip, skip + limit);
    
    res.json({
      data: paginatedPosts,
      pagination: {
        total: filteredPosts.length,
        page,
        limit,
        pages: Math.ceil(filteredPosts.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Добавим маршрут для получения постов, отсортированных по рейтингу
router.get('/top-rated', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Фильтры
    const filter = {};
    
    if (req.query.communityId) {
      filter.communityId = req.query.communityId;
    }
    
    if (req.query.dateFrom) {
      filter.date = { ...filter.date, $gte: new Date(req.query.dateFrom) };
    }
    
    if (req.query.dateTo) {
      filter.date = { ...filter.date, $lte: new Date(req.query.dateTo) };
    }
    
    // Фильтрация по минимальному рейтингу
    if (req.query.minViewRate) {
      filter.viewRate = { ...filter.viewRate, $gte: parseFloat(req.query.minViewRate) };
    }
    
    // Получаем посты, отсортированные по рейтингу просмотров (по убыванию)
    const posts = await Post.find(filter)
      .sort({ viewRate: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Post.countDocuments(filter);
    
    res.json({
      data: posts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching top rated posts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить топ постов по рейтингу просмотров
router.get('/top-rated', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const posts = await Post.find({ viewRate: { $exists: true, $ne: 0 } })
                         .sort({ viewRate: -1 })
                         .limit(parseInt(limit));
    
    res.json({
      data: posts,
      total: posts.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Маршрут очистки базы данных должен быть ПЕРЕД маршрутом получения поста по ID
router.delete('/clear', async (req, res) => {
  try {
    const result = await postService.deleteAllPosts();
    res.json({
      message: `База данных очищена. Удалено ${result.deletedPosts} постов и ${result.deletedMediaCount} медиафайлов`,
      ...result
    });
  } catch (error) {
    console.error('Error clearing posts database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить пост по ID
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить статистику по постам
router.get('/stats/overview', async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments();
    
    // Статистика по лайкам/комментариям/репостам/просмотрам
    const metrics = await Post.aggregate([
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

    // Количество постов по сообществам
    const communityCounts = await Post.aggregate([
      {
        $group: {
          _id: '$communityId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Посты по дням
    const postsByDay = await Post.aggregate([
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

    // Добавляем статистику по рейтингу
    const viewRateStats = await Post.aggregate([
      {
        $group: {
          _id: null,
          avgViewRate: { $avg: '$viewRate' },
          maxViewRate: { $max: '$viewRate' },
          minViewRate: { $min: '$viewRate' }
        }
      }
    ]);
    
    res.json({
      totalPosts,
      metrics: { ...(metrics[0] || {}), ...(viewRateStats[0] || {}) },
      communityCounts,
      postsByDay
    });
  } catch (error) {
    console.error('Error getting posts statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновляем маршрут удаления поста
router.delete('/:id', async (req, res) => {
  try {
    const result = await postService.deletePost(req.params.id);
    res.json({
      message: `Пост успешно удален вместе с ${result.deletedMediaCount} медиафайлами`,
      ...result
    });
  } catch (error) {
    console.error(`Error deleting post ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Обновляем маршрут очистки базы данных
router.delete('/clear-all', async (req, res) => {
  try {
    const result = await postService.deleteAllPosts();
    res.json({
      message: `База данных очищена. Удалено ${result.deletedPosts} постов и ${result.deletedMediaCount} медиафайлов. Сброшена статистика для ${result.resetStatsCount} задач скрапинга.`,
      ...result
    });
  } catch (error) {
    console.error('Error clearing posts database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Скачать видео из поста
router.post('/:id/download-videos', async (req, res) => {
  try {
    const result = await videoDownloadService.downloadVideosFromPost(req.params.id);
    res.json(result);
  } catch (error) {
    console.error(`Error downloading videos from post ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Скачать все видео из сообщества
router.post('/download-videos/community/:communityId', async (req, res) => {
  try {
    const result = await videoDownloadService.downloadAllVideosFromCommunity(req.params.communityId);
    res.json(result);
  } catch (error) {
    console.error(`Error downloading videos from community ${req.params.communityId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Скачать все медиа из поста
router.post('/:id/download-media', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const mediaDownloadService = require('../../services/mediaDownloadService');
    const result = await mediaDownloadService.processPostMedia(post);
    
    res.json(result);
  } catch (error) {
    console.error(`Error downloading media from post ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Скачать все медиа из сообщества
router.post('/download-media/community/:communityId', async (req, res) => {
  try {
    const posts = await Post.find({ communityId: req.params.communityId });
    
    const mediaDownloadService = require('../../services/mediaDownloadService');
    
    const results = {
      total: posts.length,
      processedPosts: 0,
      downloadedMedia: 0,
      errors: 0
    };

    for (const post of posts) {
      try {
        const result = await mediaDownloadService.processPostMedia(post);
        results.processedPosts++;
        
        if (result.status === 'processed') {
          results.downloadedMedia += result.downloadedCount;
        }
      } catch (error) {
        console.error(`Error processing post ${post._id}:`, error);
        results.errors++;
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error(`Error downloading media from community ${req.params.communityId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
