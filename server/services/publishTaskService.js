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
      console.log(task);
      return;
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
      // Save this fact in history for better reporting
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
      } catch (historyError) {
        console.error('Failed to save no-posts history:', historyError);
      }
      return;
    }
    
    // Check tokens before attempting to publish to avoid multiple failures
    try {
      const vkAuthService = require('./vkAuthService');
      const tokens = await vkAuthService.getAllTokens();
      const activeTokens = tokens.filter(t => t.isActive && !t.isExpired());
      
      if (activeTokens.length === 0) {
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
        return;
      }
      
      // Check if token has proper permissions
      // const hasProperToken = activeTokens.some(t => 
      //   t.scope && t.scope.includes('wall')
      // );
      const hasProperToken = true;
      // if (!hasProperToken) {
      //   const errorMessage = 'Отсутствуют необходимые права для публикации (wall+manage). Удалите токен и авторизуйтесь заново.';
      //   console.error(errorMessage);
        
      //   // Save error in history
      //   for (const targetGroup of task.targetGroups) {
      //     try {
      //       await publishTaskRepository.savePublishHistory({
      //         sourcePostId: bestPosts[0]?.postId || 'unknown',
      //         postId: bestPosts[0]?._id || null,
      //         sourceGroupId: bestPosts[0]?.communityId || 'unknown',
      //         targetGroupId: targetGroup.groupId,
      //         publishedAt: new Date(),
      //         publishTaskId: task._id,
      //         status: 'failed',
      //         targetPostId: 'insufficient_permissions',
      //         errorMessage: errorMessage
      //       });
      //     } catch (histErr) {
      //       console.error('Failed to save error history:', histErr);
      //     }
      //   }
        
      //   result.failed += task.targetGroups.length;
      //   return;
      // }
      // Для каждой целевой группы публикуем лучшие посты
      for (const targetGroup of task.targetGroups) {
        for (const post of bestPosts) {
          try {
            console.log(`Attempting to publish post ${post._id} to group ${targetGroup.groupId} using one of ${activeTokens?.length || 'unknown'} active tokens`);
            
            // Создаем копию поста для модификации
            const modifiedPost = { ...post.toObject() };
            
            // ВАЖНО: сначала применяем базовые трансформации текста согласно настройкам publishOptions,
            // затем применяем настройки кастомизации, которые добавляют контент
            
            // Применяем трансформации текста согласно настройкам задачи публикации
            if (task.publishOptions.removeHashtags && modifiedPost.text) {
              modifiedPost.text = this.removeHashtags(modifiedPost.text);
            }
            
            // Применяем транслитерацию, если включена
            if (task.publishOptions.transliterate && modifiedPost.text) {
              modifiedPost.text = this.transliterateText(modifiedPost.text);
            }
            
            // После базовых трансформаций применяем настройки кастомизации поста
            if (task.postCustomization) {
              // Добавляем текст в начало или конец поста
              if (task.postCustomization.addText?.enabled && task.postCustomization.addText?.text) {
                if (task.postCustomization.addText.position === 'before') {
                  modifiedPost.text = `${task.postCustomization.addText.text}\n\n${modifiedPost.text || ''}`;
                } else {
                  modifiedPost.text = `${modifiedPost.text || ''}\n\n${task.postCustomization.addText.text}`;
                }
              }
              
              // Добавляем хэштеги в конец поста
              if (task.postCustomization.addHashtags?.enabled && task.postCustomization.addHashtags?.hashtags) {
                const hashtags = task.postCustomization.addHashtags.hashtags
                  .split(/[\s,]+/)
                  .filter(tag => tag.length > 0)
                  .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
                  .join(' ');
                
                modifiedPost.text = `${modifiedPost.text || ''}\n\n${hashtags}`;
              }
              
              // Добавляем ссылку на источник
              if (task.postCustomization.addSourceLink?.enabled && post.postUrl) {
                const sourcePrefix = task.postCustomization.addSourceLink.text || 'Источник: ';
                modifiedPost.text = `${modifiedPost.text || ''}\n\n${sourcePrefix}${post.postUrl}`;
              }
              
              // Добавляем подпись в конец поста
              if (task.postCustomization.addSignature?.enabled && task.postCustomization.addSignature?.text) {
                modifiedPost.text = `${modifiedPost.text || ''}\n\n${task.postCustomization.addSignature.text}`;
              }
              
              // Добавляем изображение, если указано
              if (task.postCustomization.addImage?.enabled && task.postCustomization.addImage?.imageUrl) {
                modifiedPost.attachments = modifiedPost.attachments || [];
                modifiedPost.attachments.push({
                  type: 'photo',
                  url: task.postCustomization.addImage.imageUrl
                });
              }
            }
            
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
    } catch (tokenCheckError) {
      console.error('Error checking tokens:', tokenCheckError);
      // Continue and let the posting attempt handle specific errors
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
    return text.replace(/#[\wа-яА-ЯёЁ]+/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Транслитерирует текст (заменяет русские символы на английские аналоги)
   * @param {string} text - Исходный текст
   * @returns {string} Транслитерированный текст
   */
  transliterateText(text) {
    if (!text) return text;
    
    const translitMap = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
      'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
      'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
      'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
      'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '',
      'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };
    
    return text.split('').map(char => translitMap[char] || char).join('');
  }

  /**
   * Выполнение задачи публикации с генерацией контента
   * @param {Object} task - Задача публикации
   * @param {Object} result - Объект результата для обновления
   * @returns {Promise<void>}
   */
  async executeGeneratorTask(task, result) {
    try {
      console.log('Executing generator task with settings:', JSON.stringify(task.contentGeneratorSettings, null, 2));
      
      // Генерируем контент - используем сервис напрямую
      const contentGeneratorService = require('./contentGeneratorService');
      const generatedContent = await contentGeneratorService.generateContent(
        task.contentGeneratorSettings.generatorId,
        task.contentGeneratorSettings.params
      );
      
      if (!generatedContent) {
        throw new Error('Failed to generate content');
      }
      
      // Explicitly handle carousel mode from parameters
      if (task.contentGeneratorSettings.params.imageType === 'image' && 
          'carouselMode' in task.contentGeneratorSettings.params) {
        generatedContent.isCarousel = task.contentGeneratorSettings.params.carouselMode && 
          generatedContent.attachments && 
          generatedContent.attachments.length > 1;
        console.log(`Set isCarousel to ${generatedContent.isCarousel} for generated content`);
      }
      
      // Получаем токен доступа для публикации
      const vkAuthService = require('./vkAuthService');
      const tokens = await vkAuthService.getAllTokens();
      const activeTokens = tokens.filter(t => t.isActive && !t.isExpired());
      
      if (activeTokens.length === 0) {
        throw new Error('Нет активных токенов ВКонтакте. Необходимо авторизоваться в разделе "Авторизация ВКонтакте".');
      }
      
    
      // Выбираем первый активный токен без проверки прав
      let token = null;
      if (activeTokens.length > 0) {
        token = activeTokens[0];
        console.log(`Selected first active token for user ${token.vkUserId}`);
        
        // Логируем права токена для информации, но не фильтруем по ним
        if (token.scope) {
          const scopeStr = Array.isArray(token.scope) ? token.scope.join(', ') : token.scope;
          console.log(`Token has the following scopes: ${scopeStr}`);
        } else {
          console.log('Token does not have explicit scope information');
        }
      } else {
        throw new Error('Нет активных токенов ВКонтакте. Необходимо авторизоваться в разделе "Авторизация ВКонтакте".');
      }
      
      console.log(`Using token for user ${token.vkUserId} for content publishing`);
  
      // Публикуем сгенерированный контент в каждую целевую группу
      for (const targetGroup of task.targetGroups) {
        try {
          const publishResult = await vkPostingService.publishGeneratedPost(
            generatedContent,
            targetGroup.groupId,
            {
              ...task.publishOptions,
              saveToDatabase: true,
              taskId: task._id,
              token: token
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
