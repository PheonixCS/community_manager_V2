const { publishTaskRepository } = require('../repositories');
const vkPostingService = require('./vkPostingService');
const contentGeneratorService = require('./contentGeneratorService');
const Post = require('../models/Post');
const cron = require('node-cron');
const parser = require('cron-parser');
const { getActiveToken, preparePost} = require('./publish/core');
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
    
    let result = {
      successful: 0,
      failed: 0,
      taskId: task._id,
      executedAt: new Date()
    };
    
    // Если задача использует генератор контента
    if (task.useContentGenerator && task.contentGeneratorSettings?.generatorId) {  
      // Удаляем return, который блокирует выполнение
      result = await this.executeGeneratorTask(task, result);
      if (result) {
        await publishTaskRepository.updateTaskStatistics(task._id, {
          successful: result.successful,
          failed: result.failed
        });
      }
    } else {
      // Задача публикации лучших постов из скрапинга
      result = await this.executePostPublishingTask(task, result);
      // обновление статистики task
      if(result){
        await publishTaskRepository.updateTaskStatistics(task._id, {
          successful: result.successful,
          failed: result.failed
        });
      }
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
    
    // Check tokens before attempting to publish to avoid multiple failures
    try {
      const activeToken = await getActiveToken();
      
      if (activeToken == null) {
        const errorMessage = 'Нет активных токенов ВКонтакте. Необходимо авторизоваться в разделе "Авторизация ВКонтакте".';
        console.error(errorMessage);
        
        // Save error in history
        for (const targetGroup of task.targetGroups) {
          try {
            await publishTaskRepository.savePublishHistory({
              sourcePostId: bestPosts[0]?.postId || 'unknown',
              postId: bestPosts[0]?._id || null,
              sourceGroupId: bestPosts[0]?.communityId || 'unknown',
              targetGroupId: targetGroup.groupId,
              publishedAt: new Date(),
              publishTaskId: task._id,
              status: 'failed',
              targetPostId: 'no_tokens',
              errorMessage: errorMessage
            });
          } catch (histErr) {
            console.error('Failed to save error history:', histErr);
          }
        }
        
        result.failed += task.targetGroups.length;
        return result;
      }
      
      // Для каждой целевой группы публикуем лучшие посты
      for (const targetGroup of task.targetGroups) {
        const bestPosts = await publishTaskRepository.findBestPostsForPublishing(
          scrapingTaskIds,
          task.postsPerExecution || 1,
          task.minViewRate || 0,
          targetGroup.groupId // передаем ID целевого сообщества
        );
        
        console.log(`Found ${bestPosts.length} best posts for publishing to group ${targetGroup.groupId}`);
        
        if (bestPosts.length === 0) {
          console.log(`No suitable posts found for publishing to group ${targetGroup.groupId}`);
          try {
            await publishTaskRepository.savePublishHistory({
              sourcePostId: 'no_posts',
              postId: null,
              sourceGroupId: 'n/a',
              targetGroupId: task.targetGroups.length > 0 ? task.targetGroups[0].groupId : 'no_target',
              publishedAt: new Date(),
              publishTaskId: task._id,
              status: 'failed',
              targetPostId: 'no_suitable_posts',
              errorMessage: 'Не найдены подходящие посты для публикации'
            });
            result.failed++;
          } catch (historyError) {
            console.error('Failed to save no-posts history:', historyError);
            result.failed++;
          }
          continue;
        }
        for (const post of bestPosts) {
          try {
            console.log(`Attempting to publish post ${post._id} to group ${targetGroup.groupId} using one of ${activeToken?.length || 'unknown'} active tokens`);
            
            // Создаем копию поста для модификации
            let modifiedPost = { ...post.toObject() };
            modifiedPost = await preparePost(modifiedPost, task.publishOptions, task.postCustomization);
            
            // Публикуем пост в целевую группу, передавая модифицированный пост напрямую
            const publishResult = await vkPostingService.publishExistingPost(
              modifiedPost, // Передаем модифицированный объект поста вместо ID
              targetGroup.groupId,
              task.publishOptions,
              post._id // Передаем ID оригинального поста для обновления данных в БД
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
            if (error.data && error.data.error && error.data.error.error_code === 219) {
                await publishTaskRepository.savePublishHistory({
                  sourcePostId: post.postId,
                  postId: post._id,
                  sourceGroupId: post.communityId,
                  targetGroupId: targetGroup.groupId,
                  publishedAt: new Date(),
                  publishTaskId: task._id,
                  status: 'failed',
                  targetPostId: 'failed_publish', // Add this to prevent validation errors
                  errorMessage: `Failed to publish post after 6/6 attempts: ${error.message}`
                });
                result.failed++;
                continue;
            } else {   
                await publishTaskRepository.savePublishHistory({
                  sourcePostId: post.postId,
                  postId: post._id,
                  sourceGroupId: post.communityId,
                  targetGroupId: targetGroup.groupId,
                  publishedAt: new Date(),
                  publishTaskId: task._id,
                  status: 'failed',
                  targetPostId: 'failed_publish', // Add this to prevent validation errors
                  errorMessage: error.message || 'Unknown error'
                });
                result.failed++;
                continue;
            }
          }
        }
      }
      return result;
    } catch (tokenCheckError) {
      console.error('Error checking tokens:', tokenCheckError);
      return result;
    }
    
    
  }

  /**
   * Удаляет все хештеги из текста
   * @param {string} text - Исходный текст
   * @returns {string} Текст без хештегов
   */
  removeHashtags(text) {
    if (!text) return text;
    
    // Удаляем хештеги в формате #слово
    let result = text.replace(/#[\wа-яА-ЯёЁ]+/g, '');
    // Заменяем множественные пробелы на один, но сохраняем переносы строк
    result = result.replace(/[^\S\n]+/g, ' ');
    // Удаляем пробелы в начале и конце строк, но сохраняем переносы
    return result.trim();
  }

  /**
   * Транслитерирует текст (заменяет русские символы на английские аналоги)
   * @param {string} text - Исходный текст
   * @returns {string} Транслитерированный текст
   */
  transliterateText(text) {
    if (!text) return text;
    // console.log(text)
    const translitMap = {
      'а': 'a', 'е': 'e', 'ё': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 
      'у': 'y', 'х': 'x', 'А': 'A', 'В': 'B', 'Е': 'E', 'Ё': 'E',
      'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C',
      'Т': 'T', 'Х': 'X'
    };
    let result = text.split('').map(char => {
      // Если символ есть в мапе - заменяем, иначе оставляем как есть (включая \n, \t и другие)
      return translitMap[char] !== undefined ? translitMap[char] : char;
    }).join('');
    return result;
  }

  /**
   * Выполнение задачи публикации с генерацией контента
   * @param {Object} task - Задача публикации
   * @param {Object} result - Объект результата для обновления
   * @returns {Promise<void>}
   */
  async executeGeneratorTask(task, result) {
    try {

      const generatedContent = await contentGeneratorService.generateContent(
        task.contentGeneratorSettings.generatorId,
        task.contentGeneratorSettings.params
      );
      
      if (!generatedContent) {
        throw new Error('Failed to generate content');
      }
      
      
      // Получаем токен доступа для публикации
      const vkAuthService = require('./vkAuthService');
      const tokens = await vkAuthService.getAllTokens();
      const activeTokens = tokens.filter(t => t.isActive && !t.isExpired());
      const activeToken = activeTokens[0];
      if (!activeToken) {
        await publishTaskRepository.savePublishHistory({
          sourcePostId: 'no_posts',
          postId: null,
          sourceGroupId: 'n/a',
          targetGroupId: task.targetGroups.length > 0 ? task.targetGroups[0].groupId : 'no_target',
          publishedAt: new Date(),
          publishTaskId: task._id,
          status: 'failed',
          targetPostId: 'no_tokens',
          errorMessage: 'Нет активных токенов ВКонтакте. Необходимо авторизоваться в разделе "Авторизация ВКонтакте".'
        });
        result.failed += task.targetGroups.length;
        throw new Error('No active tokens available for publishing');
      } 
      
      // Публикуем сгенерированный контент в каждую целевую группу
      // console.log(activeToken);
      for (const targetGroup of task.targetGroups) {
        try {
          const publishResult = await vkPostingService.publishGeneratedPost(
            generatedContent,
            targetGroup.groupId,
            {
              ...task.contentGeneratorSettings.params,
              ...task.publishOptions,
              saveToDatabase: true,
              taskId: task._id,
              token: activeToken
            }
          );
          
          if (publishResult.status === 'success') {
            result.successful++;
            await publishTaskRepository.savePublishHistory({
              sourcePostId: 'no_posts',
              postId: null,
              sourceGroupId: 'n/a',
              targetGroupId: targetGroup.groupId,
              publishedAt: new Date(),
              publishTaskId: task._id,
              status: 'success',
              targetPostId: publishResult.postId || 'unknown',
              targetPostUrl: publishResult.vkUrl || ''
            });
          } else {
            result.failed++;
          }
          
        } catch (error) {
          await publishTaskRepository.savePublishHistory({
            sourcePostId: 'no_posts',
            postId: null,
            sourceGroupId: 'n/a',
            targetGroupId: targetGroup.groupId,
            publishedAt: new Date(),
            publishTaskId: task._id,
            status: 'failed',
            targetPostId: 'failed_publish',
            errorMessage: error.message || 'Unknown error'
          });
          console.error(`Error publishing generated content to group ${targetGroup.groupId}:`, error);
          result.failed++;
        }
      }
      
    } catch (error) {
      await publishTaskRepository.savePublishHistory({
        sourcePostId: 'no_posts',
        postId: null,
        sourceGroupId: 'n/a',
        targetGroupId: task.targetGroups.length > 0 ? task.targetGroups[0].groupId : 'no_target',
        publishedAt: new Date(),
        publishTaskId: task._id,
        status: 'failed',
        targetPostId: 'failed_generator',
        errorMessage: error.message || 'Failed to generate content'
      });       
      console.error(`Error executing generator task ${task._id}:`, error);
      result.failed += task.targetGroups.length; // Считаем все попытки как неудачные
    }
    return result;
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
      console.log(preparedTask.schedule?.cronExpression);
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
      
      // Всегда обновляем время следующего выполнения.
      if (updateData.type === 'schedule') {
        
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
   * Добавление постов к задаче публикации
   * @param {string} taskId - ID задачи
   * @param {Array<string>} postIds - Массив ID постов
   */
  
  /**
   * Получение списка доступных генераторов контента
   * @returns {Array<Object>} Список генераторов с их параметрами
   */
  getAvailableContentGenerators() {
    const contentGeneratorService = require('./contentGeneratorService');
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
