const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const publishTaskService = require('../../services/publishTaskService');
const contentGeneratorService = require('../../services/contentGeneratorService');
const publishTaskRepository = require('../../repositories/PublishTaskRepository');
const PublishTask = require('../../models/PublishTask');
const PublishHistory = require('../../models/PublishHistory');

/**
 * Получение списка задач публикации
 * GET /api/publishing/tasks
 */
router.get('/tasks', async (req, res) => {
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
      .populate('scrapingTasks')
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
 * GET /api/publishing/tasks/:id
 */
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await PublishTask.findById(req.params.id)
      .populate('scrapingTasks');
    
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
 * POST /api/publishing/tasks
 */
router.post('/tasks', async (req, res) => {
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
 * PUT /api/publishing/tasks/:id
 */
router.put('/tasks/:id', async (req, res) => {
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
 * DELETE /api/publishing/tasks/:id
 */
router.delete('/tasks/:id', async (req, res) => {
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
 * POST /api/publishing/tasks/:id/execute
 */
router.post('/tasks/:id/execute', async (req, res) => {
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
 * Получение истории публикаций для задачи
 * GET /api/publishing/tasks/:id/history
 */
router.get('/tasks/:id/history', async (req, res) => {
  try {
    const history = await publishTaskService.getTaskHistory(req.params.id);
    
    // Format response consistently
    res.json({
      data: history,
      pagination: {
        total: history.length,
        page: 1,
        limit: history.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error(`Error fetching history for task ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Получение истории публикаций для поста
 * GET /api/publishing/history/post/:postId
 */
router.get('/history/post/:postId', async (req, res) => {
  try {
    const history = await publishTaskService.getPostPublishHistory(req.params.postId);
    
    // Format response consistently
    res.json({
      data: history,
      pagination: {
        total: history.length,
        page: 1,
        limit: history.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error(`Error fetching publish history for post ${req.params.postId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/publishing/generators
 * @desc    Get available content generators
 * @access  Public - данный эндпоинт доступен всем (без проверки авторизации)
 */
router.get('/generators', async (req, res) => {
  try {
    // Debug log to see if we're reaching this point
    // console.log('GET /api/publishing/generators endpoint called');
    
    // Get generators from service
    const generators = contentGeneratorService.getAvailableGenerators();
    // console.log(`Retrieved ${generators ? generators.length : 'undefined'} content generators`);
    
    // Add detailed logging
    if (!generators || generators.length === 0) {
      console.log('No generators found. Attempting to reload...');
      
      // Force reload generators
      await contentGeneratorService.loadGenerators();
      const reloadedGenerators = contentGeneratorService.getAvailableGenerators();
      console.log(`After reload: ${reloadedGenerators ? reloadedGenerators.length : 'undefined'} content generators`);
      
      // If still empty, check what's in the directory
      // const fs = require('fs');
      // const path = require('path');
      // const generatorsDir = path.join(__dirname, '../../services/contentGenerators');
      
      // if (fs.existsSync(generatorsDir)) {
      //   const files = fs.readdirSync(generatorsDir);
      //   console.log(`Files in generators directory: ${files.join(', ')}`);
      // } else {
      //   console.log(`Generators directory does not exist: ${generatorsDir}`);
      // }
      
      return res.json(reloadedGenerators || []);
    }
    
    return res.json(generators);
  } catch (error) {
    console.error('Error fetching content generators:', error);
    return res.status(500).json({ 
      error: 'Error fetching content generators',
      details: error.message 
    });
  }
});

/**
 * Публикация существующего поста
 * POST /api/publishing/publish-post
 */
router.post('/publish-post', async (req, res) => {
  try {
    const { postId, communityId, options } = req.body;
    
    if (!postId || !communityId) {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Post ID and community ID are required' 
      });
    }
    
    // Проверяем, что communityId в правильном формате (с минусом для групп)
    let formattedCommunityId = communityId;
    if (!communityId.startsWith('-')) {
      formattedCommunityId = `-${communityId}`;
    }
    
    // Validate community ID format (must be numeric after - sign)
    if (!/^-\d+$/.test(formattedCommunityId)) {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid community ID format. Must be a negative number (e.g., -123456)'
      });
    }
    
    const vkPostingService = require('../../services/vkPostingService');
    
    // Verify token permissions first
    try {
      const vkAuthService = require('../../services/vkAuthService');
      const token = await vkAuthService.getActiveToken(['wall', 'photos', 'groups', 'manage']);
      
      if (!token) {
        return res.status(401).json({
          status: 'error',
          error: 'Не найден активный токен ВКонтакте. Пожалуйста, авторизуйтесь в разделе "Авторизация ВКонтакте".'
        });
      }
      
      // Check token has the critical permissions
      // const hasWall = token.scope && token.scope.includes('wall');
      // const hasManage = token.scope && token.scope.includes('manage');
      
      // if (!hasWall || !hasManage) {
      //   return res.status(401).json({
      //     status: 'error',
      //     error: `Токен не имеет необходимых прав. ${!hasWall ? 'Отсутствует право "wall". ' : ''}${!hasManage ? 'Отсутствует право "manage". ' : ''}Пожалуйста, удалите этот токен и авторизуйтесь заново, предоставив все запрашиваемые разрешения.`
      //   });
      // }
      
    } catch (tokenError) {
      console.error('Error checking token permissions:', tokenError);
      // Continue and let the posting service handle token errors
    }
    
    try {
      const result = await vkPostingService.publishExistingPost(
        postId, 
        formattedCommunityId, 
        options
      );
      
      if (result.status === 'error') {
        return res.status(400).json(result);
      }
      
      // Сохраняем историю публикации
      try {
        const post = await require('mongoose').model('Post').findById(postId);
        
        if (post) {
          await publishTaskRepository.savePublishHistory({
            sourcePostId: post.postId,
            postId: post._id,
            sourceGroupId: post.communityId,
            targetGroupId: formattedCommunityId,
            targetPostId: result.postId || 'manual_publish',
            targetPostUrl: result.vkUrl || '',
            publishedAt: new Date(),
            status: 'success'
          });
        }
      } catch (historyError) {
        console.error('Error saving publish history:', historyError);
        // We still return success even if history saving fails
      }
      
      res.json(result);
    } catch (vkError) {
      // More detailed error handling
      let errorMessage = vkError.message;
      let errorDetails = '';
      
      // Check for specific error types and provide more helpful messages
      if (errorMessage.includes('Too many requests per second')) {
        errorMessage = 'Слишком много запросов к API ВКонтакте. Пожалуйста, подождите и попробуйте снова.';
        errorDetails = 'Возможно, требуется уменьшить количество вложений или публиковать реже.';
      } else if (errorMessage.includes('no access to call this method')) {
        errorMessage = 'Отсутствуют необходимые права для публикации в сообщество.';
        errorDetails = 'Требуются права "Управление сообществом" и "Доступ к стене". Удалите текущий токен и авторизуйтесь заново.';
      } else if (errorMessage.includes('community access denied')) {
        errorMessage = 'Доступ к сообществу запрещен.';
        errorDetails = 'Возможно, вы не являетесь администратором этого сообщества или сообщество закрыто.';
      }
      
      return res.status(400).json({
        status: 'error',
        error: errorMessage,
        details: errorDetails || vkError.message
      });
    }
  } catch (error) {
    console.error('Error publishing post:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * Публикация сгенерированного контента
 * POST /api/publishing/publish-generated
 */
router.post('/publish-generated', async (req, res) => {
  try {
    const { generatorId, params, communityId, options } = req.body;
    
    if (!generatorId || !communityId) {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Generator ID and community ID are required' 
      });
    }
    
    // Генерируем контент - исправляем прямой вызов contentGeneratorService вместо доступа через publishTaskService
    const generatedContent = await contentGeneratorService.generateContent(
      generatorId,
      params
    );
    
    if (!generatedContent) {
      return res.status(400).json({
        status: 'error',
        error: 'Failed to generate content'
      });
    }
    
    // Проверяем, что communityId в правильном формате (с минусом для групп)
    let formattedCommunityId = communityId;
    if (!communityId.startsWith('-')) {
      formattedCommunityId = `-${communityId}`;
    }
    
    // Публикуем сгенерированный контент
    const vkPostingService = require('../../services/vkPostingService');
    const result = await vkPostingService.publishGeneratedPost(
      generatedContent, 
      formattedCommunityId, 
      options
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error publishing generated content:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

/**
 * Получение общей истории публикаций
 * GET /api/publishing/history
 */
router.get('/history', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      dateFrom, 
      dateTo, 
      targetGroupId, 
      taskId 
    } = req.query;
    const skip = (page - 1) * limit;
    
    // Построение фильтра
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (dateFrom || dateTo) {
      filter.publishedAt = {};
      if (dateFrom) {
        filter.publishedAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.publishedAt.$lte = new Date(dateTo);
      }
    }
    
    if (targetGroupId) {
      filter.targetGroupId = targetGroupId;
    }
    
    if (taskId) {
      if (taskId === 'manual') {
        filter.publishTaskId = { $exists: false };
      } else {
        filter.publishTaskId = taskId;
      }
    }
    
    // Получение истории публикаций с пагинацией
    const history = await PublishHistory.find(filter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PublishHistory.countDocuments(filter);
    
    res.json({
      data: history,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching publish history:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
