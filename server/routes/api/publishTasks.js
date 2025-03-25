const express = require('express');
const router = express.Router();
const publishTaskService = require('../../services/publishTaskService');
const PublishTask = require('../../models/PublishTask');
const PublishHistory = require('../../models/PublishHistory');

/**
 * Получение списка задач публикации
 * GET /api/publish-tasks
 */
router.get('/', async (req, res) => {
  try {
    const { type, active, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    // Построение фильтра
    const filter = {};
    
    if (type) {
      filter.type = type;
    }
    
    if (active !== undefined) {
      filter['schedule.active'] = active === 'true';
    }
    
    // Получение задач с пагинацией
    const tasks = await PublishTask.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PublishTask.countDocuments(filter);
    
    res.json({
      data: tasks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching publish tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Получение задачи публикации по ID
 * GET /api/publish-tasks/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const task = await PublishTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Publish task not found' });
    }
    
    res.json(task);
  } catch (error) {
    console.error(`Error fetching publish task ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Создание новой задачи публикации
 * POST /api/publish-tasks
 */
router.post('/', async (req, res) => {
  try {
    const taskData = req.body;
    const task = await publishTaskService.createTask(taskData);
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating publish task:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Обновление задачи публикации
 * PUT /api/publish-tasks/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const taskData = req.body;
    const task = await publishTaskService.updateTask(req.params.id, taskData);
    
    if (!task) {
      return res.status(404).json({ error: 'Publish task not found' });
    }
    
    res.json(task);
  } catch (error) {
    console.error(`Error updating publish task ${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Удаление задачи публикации
 * DELETE /api/publish-tasks/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const task = await PublishTask.findByIdAndDelete(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Publish task not found' });
    }
    
    res.json({ message: 'Publish task deleted successfully' });
  } catch (error) {
    console.error(`Error deleting publish task ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Немедленное выполнение задачи публикации
 * POST /api/publish-tasks/:id/execute
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const result = await publishTaskService.executeTaskNow(req.params.id);
    
    res.json({
      message: `Task executed successfully with ${result.successful} successful and ${result.failed} failed publications`,
      result
    });
  } catch (error) {
    console.error(`Error executing publish task ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Добавление постов в задачу публикации
 * POST /api/publish-tasks/:id/add-posts
 */
router.post('/:id/add-posts', async (req, res) => {
  try {
    const { postIds } = req.body;
    
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({ error: 'Post IDs array is required' });
    }
    
    const task = await publishTaskService.addPostsToTask(req.params.id, postIds);
    
    if (!task) {
      return res.status(404).json({ error: 'Publish task not found' });
    }
    
    res.json({
      message: `Added ${postIds.length} posts to the task`,
      task
    });
  } catch (error) {
    console.error(`Error adding posts to task ${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Получение истории публикаций для задачи
 * GET /api/publish-tasks/:id/history
 */
router.get('/:id/history', async (req, res) => {
  try {
    const history = await publishTaskService.getTaskHistory(req.params.id);
    
    res.json(history);
  } catch (error) {
    console.error(`Error fetching history for task ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Получение истории публикаций для поста
 * GET /api/publish-tasks/history/post/:postId
 */
router.get('/history/post/:postId', async (req, res) => {
  try {
    const history = await publishTaskService.getPostPublishHistory(req.params.postId);
    
    res.json(history);
  } catch (error) {
    console.error(`Error fetching publish history for post ${req.params.postId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
