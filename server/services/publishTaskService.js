const { publishTaskRepository } = require('../repositories');
const vkPostingService = require('./vkPostingService');
const contentGeneratorService = require('./contentGeneratorService');
const Post = require('../models/Post');
const cron = require('node-cron');
const parser = require('cron-parser');

/**
 * Сервис для управления задачами публикации в ВК
 */
class PublishTaskService {
  constructor() {
    // Инициализация планировщика задач
    this.scheduledJobs = {};
    
    // Запуск проверки задач при старте сервиса
    this.initScheduler();
  }

  /**
   * Инициализация планировщика задач
   */
  async initScheduler() {
    try {
      console.log('Initializing publish task scheduler...');
      
      // Запускаем периодическую проверку задач по расписанию (каждую минуту)
      cron.schedule('* * * * *', async () => {
        await this.checkScheduledTasks();
      });
      
      // Запускаем периодическую проверку разовых задач (каждую минуту)
      cron.schedule('* * * * *', async () => {
        await this.checkOneTimeTasks();
      });
      
      console.log('Publish task scheduler initialized');
    } catch (error) {
      console.error('Error initializing publish task scheduler:', error);
    }
  }

  /**
   * Проверка и выполнение задач по расписанию
   */
  async checkScheduledTasks() {
    try {
      const tasks = await publishTaskRepository.findScheduledTasksDueForExecution();
      console.log(`Found ${tasks.length} scheduled tasks due for execution`);
      
      for (const task of tasks) {
        try {
          // Выполняем задачу
          await this.executeTask(task);
          
          // Рассчитываем время следующего запуска
          const nextExecutionTime = await publishTaskRepository.calculateNextExecutionTime(
            task.schedule.cronExpression
          );
          
          // Обновляем статистику и время следующего запуска
          await publishTaskRepository.updateTaskStatistics(task._id, {
            successful: task.statistics?.successfulPublications || 0,
            failed: task.statistics?.failedPublications || 0,
            nextExecutionAt: nextExecutionTime
          });
          
        } catch (error) {
          console.error(`Error executing scheduled task ${task._id}:`, error);
          // Обновляем статистику с ошибкой
          await publishTaskRepository.updateTaskStatistics(task._id, {
            failed: 1
          });
        }
      }
    } catch (error) {
      console.error('Error checking scheduled tasks:', error);
    }
  }

  /**
   * Проверка и выполнение разовых задач
   */
  async checkOneTimeTasks() {
    try {
      const tasks = await publishTaskRepository.findOneTimeTasksDueForExecution();
      console.log(`Found ${tasks.length} one-time tasks due for execution`);
      
      for (const task of tasks) {
        try {
          // Выполняем задачу
          await this.executeTask(task);
          
          // Обновляем статистику и отмечаем как выполненную
          await publishTaskRepository.updateTaskStatistics(task._id, {
            successful: task.statistics?.successfulPublications || 0,
            failed: task.statistics?.failedPublications || 0
          });
          
        } catch (error) {
          console.error(`Error executing one-time task ${task._id}:`, error);
          // Обновляем статистику с ошибкой
          await publishTaskRepository.updateTaskStatistics(task._id, {
            failed: 1
          });
        }
      }
    } catch (error) {
      console.error('Error checking one-time tasks:', error);
    }
  }

  /**
   * Выполнение задачи публикации
   * @param {Object} task - Задача публикации
   * @returns {Promise<Object>} Результат выполнения
   */
  async executeTask(task) {
    console.log(`Executing publish task ${task._id}: ${task.name}`);
    
    const result = {
      successful: 0,
      failed: 0,
      taskId: task._id,
      executedAt: new Date()
    };
    
    // Если задача использует генератор контента
    if (task.useContentGenerator && task.contentGeneratorSettings?.generatorId) {
      await this.executeGeneratorTask(task, result);
    } else {
      // Задача публикации лучших постов из скрапинга
      await this.executePostPublishingTask(task, result);
    }
    
    console.log(`Publish task ${task._id} executed with result: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Выполнение задачи публикации лучших постов
   * @param {Object} task - Задача публикации
   * @param {Object} result - Объект результата для обновления
   * @returns {Promise<void>}
   */
  async executePostPublishingTask(task, result) {
    // Получаем ID задач скрапинга
    const scrapingTaskIds = task.scrapingTasks.map(t => 
      typeof t === 'string' ? t : t._id.toString()
    );
    
    if (scrapingTaskIds.length === 0) {
      console.log(`No scraping tasks defined for publish task ${task._id}`);
      return;
    }
    
    // Находим лучшие посты для публикации
    const bestPosts = await publishTaskRepository.findBestPostsForPublishing(
      scrapingTaskIds,
      task.postsPerExecution || 1,
      task.minViewRate || 0
    );
    
    console.log(`Found ${bestPosts.length} best posts for publishing`);
    
    if (bestPosts.length === 0) {
      console.log('No suitable posts found for publishing');
      return;
    }
    
    // Для каждой целевой группы публикуем лучшие посты
    for (const targetGroup of task.targetGroups) {
      for (const post of bestPosts) {
        try {
          // 1. Проверяем наличие активных токенов перед публикацией
          const vkAuthService = require('./vkAuthService');
          const tokens = await vkAuthService.getAllTokens();
          const activeTokens = tokens.filter(t => t.isActive);
          
          if (activeTokens.length === 0) {
            throw new Error('Нет активных токенов ВКонтакте. Необходимо авторизоваться в разделе "Авторизация ВКонтакте".');
          }
          
          console.log(`Attempting to publish post ${post._id} to group ${targetGroup.groupId} using one of ${activeTokens.length} active tokens`);
          
          // 2. Публикуем пост в целевую группу
          const publishResult = await vkPostingService.publishExistingPost(
            post._id.toString(),
            targetGroup.groupId,
            task.publishOptions
          );
          
          if (publishResult.status === 'success') {
            // Сохраняем историю публикации
            await publishTaskRepository.savePublishHistory({
              sourcePostId: post.postId,
              postId: post._id,
              sourceGroupId: post.communityId,
              targetGroupId: targetGroup.groupId,
              targetPostId: publishResult.postId || 'unknown',
              targetPostUrl: publishResult.vkUrl || '',
              publishedAt: new Date(),
              publishTaskId: task._id,
              status: 'success'
            });
            
            result.successful++;
          } else {
            // Сохраняем информацию об ошибке
            await publishTaskRepository.savePublishHistory({
              sourcePostId: post.postId,
              postId: post._id,
              sourceGroupId: post.communityId,
              targetGroupId: targetGroup.groupId,
              publishedAt: new Date(),
              publishTaskId: task._id,
              status: 'failed',
              targetPostId: 'failed_publish', // Add this to prevent validation errors
              errorMessage: publishResult.error || 'Unknown error'
            });
            
            result.failed++;
          }
          
        } catch (error) {
          console.error(`Error publishing post ${post._id} to group ${targetGroup.groupId}:`, error);
          
          // Добавляем дополнительное сообщение, если ошибка связана с отсутствием токена
          let errorMessage = error.message;
          if (error.message.includes('токен') || error.message.includes('авторизоваться')) {
            errorMessage += ' Перейдите в раздел "Авторизация ВКонтакте" для добавления токена.';
          }
          
          // Save error information (with error handling)
          try {
            await publishTaskRepository.savePublishHistory({
              sourcePostId: post.postId || 'unknown',
              postId: post._id,
              sourceGroupId: post.communityId || 'unknown',
              targetGroupId: targetGroup.groupId,
              publishedAt: new Date(),
              publishTaskId: task._id,
              status: 'failed',
              targetPostId: 'error', // Add this to prevent validation errors
              errorMessage: errorMessage
            });
          } catch (historyError) {
            console.error('Failed to save error history:', historyError);
          }
          
          result.failed++;
        }
      }
    }
  }

  /**
   * Выполнение задачи публикации с генерацией контента
   * @param {Object} task - Задача публикации
   * @param {Object} result - Объект результата для обновления
   * @returns {Promise<void>}
   */
  async executeGeneratorTask(task, result) {
    try {
      // Генерируем контент
      const generatedContent = await contentGeneratorService.generateContent(
        task.contentGeneratorSettings.generatorId,
        task.contentGeneratorSettings.params
      );
      
      if (!generatedContent) {
        throw new Error('Failed to generate content');
      }
      
      // Публикуем сгенерированный контент в каждую целевую группу
      for (const targetGroup of task.targetGroups) {
        try {
          const publishResult = await vkPostingService.publishGeneratedPost(
            generatedContent,
            targetGroup.groupId,
            {
              ...task.publishOptions,
              saveToDatabase: true,
              taskId: task._id
            }
          );
          
          if (publishResult.status === 'success') {
            result.successful++;
          } else {
            result.failed++;
          }
          
        } catch (error) {
          console.error(`Error publishing generated content to group ${targetGroup.groupId}:`, error);
          result.failed++;
        }
      }
      
    } catch (error) {
      console.error(`Error executing generator task ${task._id}:`, error);
      result.failed += task.targetGroups.length; // Считаем все попытки как неудачные
    }
  }

  /**
   * Создание новой задачи публикации
   * @param {Object} taskData - Данные задачи
   * @returns {Promise<Document>} Созданная задача
   */
  async createTask(taskData) {
    try {
      // Валидация и подготовка данных задачи
      const preparedTask = { ...taskData };
      
      // Для задач по расписанию рассчитываем время следующего запуска
      if (preparedTask.type === 'schedule' && preparedTask.schedule?.cronExpression) {
        const nextExecutionTime = await publishTaskRepository.calculateNextExecutionTime(
          preparedTask.schedule.cronExpression
        );
        
        if (!nextExecutionTime) {
          throw new Error('Invalid cron expression');
        }
        
        preparedTask.statistics = {
          ...preparedTask.statistics,
          nextExecutionAt: nextExecutionTime
        };
      }
      
      // Создаем задачу
      const task = await publishTaskRepository.create(preparedTask);
      console.log(`Created publish task ${task._id}: ${task.name}`);
      
      return task;
    } catch (error) {
      console.error('Error creating publish task:', error);
      throw error;
    }
  }

  /**
   * Немедленное выполнение задачи публикации
   * @param {string} taskId - ID задачи
   * @returns {Promise<Object>} Результат выполнения
   */
  async executeTaskNow(taskId) {
    try {
      const task = await publishTaskRepository.findById(taskId);
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Выполняем задачу
      const result = await this.executeTask(task);
      
      // Обновляем статистику
      await publishTaskRepository.updateTaskStatistics(taskId, {
        successful: result.successful,
        failed: result.failed
      });
      
      return result;
    } catch (error) {
      console.error(`Error executing task ${taskId} now:`, error);
      throw error;
    }
  }

  /**
   * Обновление существующей задачи публикации
   * @param {string} taskId - ID задачи
   * @param {Object} taskData - Новые данные задачи
   * @returns {Promise<Document|null>} Обновленная задача
   */
  async updateTask(taskId, taskData) {
    try {
      // Получаем текущую задачу
      const currentTask = await publishTaskRepository.findById(taskId);
      if (!currentTask) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Подготавливаем данные для обновления
      const updateData = { ...taskData };
      
      // Если меняется cron-выражение, рассчитываем новое время следующего запуска
      if (updateData.type === 'schedule' && 
          updateData.schedule?.cronExpression &&
          updateData.schedule.cronExpression !== currentTask.schedule?.cronExpression) {
        
        const nextExecutionTime = await publishTaskRepository.calculateNextExecutionTime(
          updateData.schedule.cronExpression
        );
        
        if (!nextExecutionTime) {
          throw new Error('Invalid cron expression');
        }
        
        updateData.statistics = {
          ...updateData.statistics,
          nextExecutionAt: nextExecutionTime
        };
      }
      
      // Обновляем задачу
      const updatedTask = await publishTaskRepository.update(taskId, updateData);
      console.log(`Updated publish task ${taskId}`);
      
      return updatedTask;
    } catch (error) {
      console.error(`Error updating publish task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Получение доступных генераторов контента
   * @returns {Array<Object>} Массив генераторов
   */
  getAvailableContentGenerators() {
    return contentGeneratorService.getAvailableGenerators();
  }

  /**
   * Получение истории публикаций для задачи
   * @param {string} taskId - ID задачи
   * @returns {Promise<Document[]>} Массив записей истории
   */
  async getTaskHistory(taskId) {
    return await publishTaskRepository.getTaskPublishHistory(taskId);
  }

  /**
   * Получение истории публикаций для поста
   * @param {string} postId - ID поста
   * @returns {Promise<Document[]>} Массив записей истории
   */
  async getPostPublishHistory(postId) {
    return await publishTaskRepository.getPostPublishHistory(postId);
  }
}

module.exports = new PublishTaskService();
