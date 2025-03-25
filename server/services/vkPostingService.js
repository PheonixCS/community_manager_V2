const axios = require('axios');
const Settings = require('../models/Settings');
const Post = require('../models/Post');
const vkApiService = require('./vkApiService');
const vkAuthService = require('./vkAuthService');
const { postRepository } = require('../repositories');
const config = require('../config/config');

/**
 * Сервис для публикации постов в сообщества ВКонтакте
 */
class VkPostingService {
  /**
   * Получить токен публикации для постинга
   * @returns {Promise<string|null>} Токен публикации или null
   */
  async getPublishToken() {
    try {
      // Сначала пытаемся получить пользовательский токен с нужными правами
      const requiredScope = ['wall', 'groups'];
      
      // 1. Пробуем сначала найти любой активный токен
      let userToken = await vkAuthService.getActiveToken(requiredScope);
      
      if (!userToken) {
        console.log('No token with both wall and groups scope found, trying with just wall scope...');
        // 2. Если не найден с обоими разрешениями, пробуем хотя бы с wall
        userToken = await vkAuthService.getActiveToken(['wall']);
      }
      
      if (userToken) {
        console.log(`Using VK user token for user ${userToken.vkUserName} (${userToken.vkUserId}), scope: ${userToken.scope.join(',')}`);
        return userToken.accessToken;
      }
      
      // 3. Пробуем получить все токены и посмотреть, в чем проблема
      const allTokens = await vkAuthService.getAllTokens();
      if (allTokens && allTokens.length > 0) {
        const activeTokens = allTokens.filter(t => t.isActive);
        
        if (activeTokens.length > 0) {
          console.log(`Found ${activeTokens.length} active tokens but none with required scopes. Using first available token.`);
          console.log(`Token scopes available: ${activeTokens[0].scope.join(',')}`);
          // Используем первый активный токен, даже если у него нет всех нужных прав
          return activeTokens[0].accessToken;
        } else {
          console.log(`Found ${allTokens.length} tokens but none are active`);
        }
      } else {
        console.log('No VK user tokens found in database');
      }
      
      // Если дошли до этой точки, значит пользовательский токен не найден
      throw new Error('Не найден активный пользовательский токен ВКонтакте. Необходимо авторизоваться в ВКонтакте через раздел "Авторизация ВКонтакте".');
    } catch (error) {
      console.error('Error getting VK publish token:', error);
      throw error; // Пробрасываем ошибку дальше, чтобы показать пользователю
    }
  }

  /**
   * Публикация существующего поста из базы данных
   * @param {string} postId - ID поста в базе данных
   * @param {string} communityId - ID сообщества ВК (формат: -12345)
   * @param {Object} options - Дополнительные опции публикации
   * @returns {Promise<Object>} Результат публикации
   */
  async publishExistingPost(postId, communityId, options = {}) {
    try {
      console.log(`Publishing existing post ${postId} to community ${communityId}`);
      
      // 1. Получаем токен публикации
      const token = await this.getPublishToken();
      if (!token) {
        throw new Error('Failed to get publish token. Authorize VK user first.');
      }
      
      // 2. Получаем пост из базы данных
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error(`Post with ID ${postId} not found`);
      }
      
      // 3. Подготавливаем данные для публикации
      const postData = {
        owner_id: communityId, // ID сообщества со знаком минус
        message: post.text || '',
        // Добавляем attachments, если есть
        attachments: await this.prepareAttachments(post.attachments, token, communityId),
        // Применяем опции публикации
        ...this.preparePublishOptions(options)
      };
      
      // 4. Публикуем пост через VK API
      const result = await this.makeWallPostRequest(postData, token);
      
      // 5. Обновляем информацию о посте в базе данных
      await this.updatePostAfterPublish(post, result, communityId);
      
      return {
        status: 'success',
        postId: result.post_id,
        message: `Post successfully published to VK community ${communityId}`,
        vkUrl: `https://vk.com/wall${communityId}_${result.post_id}`
      };
      
    } catch (error) {
      console.error('Error publishing existing post:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Публикация сгенерированного на лету поста
   * @param {Object} postData - Данные поста для публикации
   * @param {string} communityId - ID сообщества ВК (формат: -12345)
   * @param {Object} options - Дополнительные опции публикации
   * @returns {Promise<Object>} Результат публикации
   */
  async publishGeneratedPost(postData, communityId, options = {}) {
    try {
      console.log(`Publishing generated post to community ${communityId}`);
      
      // 1. Получаем токен публикации
      const token = await this.getPublishToken();
      if (!token) {
        throw new Error('Failed to get publish token. Authorize VK user first.');
      }
      
      // 2. Проверяем, что postData содержит необходимые данные
      if (!postData || typeof postData !== 'object') {
        throw new Error('Invalid post data provided');
      }
      
      // 3. Подготавливаем данные для публикации
      const publishData = {
        owner_id: communityId,
        message: postData.text || '',
        // Добавляем attachments, если есть
        attachments: await this.prepareAttachments(postData.attachments, token, communityId),
        // Применяем опции публикации
        ...this.preparePublishOptions(options)
      };
      
      // 4. Публикуем пост через VK API
      const result = await this.makeWallPostRequest(publishData, token);
      
      // 5. Если нужно сохранить сгенерированный пост в базу, делаем это здесь
      let savedPost = null;
      if (options.saveToDatabase) {
        savedPost = await this.saveGeneratedPostToDatabase(
          postData, 
          result, 
          communityId,
          options.taskId
        );
      }
      
      return {
        status: 'success',
        postId: result.post_id,
        message: `Generated post successfully published to VK community ${communityId}`,
        vkUrl: `https://vk.com/wall${communityId}_${result.post_id}`,
        savedPost: savedPost ? {
          id: savedPost._id,
          message: 'Post also saved to database'
        } : null
      };
      
    } catch (error) {
      console.error('Error publishing generated post:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Подготовка вложений для публикации
   * @param {Array} attachments - Массив вложений
   * @param {string} token - Токен публикации
   * @param {string} communityId - ID сообщества
   * @returns {Promise<string>} Строка с вложениями для VK API
   */
  async prepareAttachments(attachments, token, communityId) {
    if (!attachments || attachments.length === 0) {
      return '';
    }
    
    // Здесь будем собирать строки для attachments
    const attachmentStrings = [];
    
    // Обрабатываем каждый тип вложений
    for (const attachment of attachments) {
      try {
        if (attachment.type === 'photo') {
          // Загружаем фото на сервер ВК
          const photoAttachment = await this.uploadPhotoToVk(
            attachment.url || attachment.photo?.url || attachment.photo?.sizes?.[0]?.url,
            token,
            communityId
          );
          if (photoAttachment) {
            attachmentStrings.push(photoAttachment);
          }
        } 
        else if (attachment.type === 'video') {
          // Для видео можно использовать существующие ID или загружать новые
          if (attachment.video?.owner_id && attachment.video?.id) {
            attachmentStrings.push(`video${attachment.video.owner_id}_${attachment.video.id}`);
          }
        }
        else if (attachment.type === 'doc') {
          // Для документов можно использовать существующие ID или загружать новые
          if (attachment.doc?.owner_id && attachment.doc?.id) {
            attachmentStrings.push(`doc${attachment.doc.owner_id}_${attachment.doc.id}`);
          }
        }
        // Добавьте обработку других типов вложений при необходимости
      } catch (error) {
        console.error(`Error processing attachment of type ${attachment.type}:`, error);
        // Продолжаем с другими вложениями
      }
    }
    
    return attachmentStrings.join(',');
  }

  /**
   * Загрузка фото на сервер ВК
   * @param {string} photoUrl - URL фотографии
   * @param {string} token - Токен публикации
   * @param {string} communityId - ID сообщества
   * @returns {Promise<string|null>} Строка с ID фото для VK API или null
   */
  async uploadPhotoToVk(photoUrl, token, communityId) {
    try {
      if (!photoUrl) {
        throw new Error('Photo URL is required');
      }
      
      // 1. Получаем сервер для загрузки фото
      const uploadServerResponse = await axios.get('https://api.vk.com/method/photos.getWallUploadServer', {
        params: {
          group_id: communityId.replace('-', ''),
          access_token: token,
          v: '5.131'
        }
      });
      
      if (uploadServerResponse.data.error) {
        throw new Error(`VK API Error: ${uploadServerResponse.data.error.error_msg}`);
      }
      
      const uploadUrl = uploadServerResponse.data.response.upload_url;
      
      // 2. Скачиваем фото и загружаем на сервер ВК
      const photoResponse = await axios.get(photoUrl, { responseType: 'arraybuffer' });
      const formData = new FormData();
      formData.append('photo', new Blob([photoResponse.data]), 'photo.jpg');
      
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // 3. Сохраняем фото на стену
      const saveResponse = await axios.get('https://api.vk.com/method/photos.saveWallPhoto', {
        params: {
          group_id: communityId.replace('-', ''),
          photo: uploadResponse.data.photo,
          server: uploadResponse.data.server,
          hash: uploadResponse.data.hash,
          access_token: token,
          v: '5.131'
        }
      });
      
      if (saveResponse.data.error) {
        throw new Error(`VK API Error: ${saveResponse.data.error.error_msg}`);
      }
      
      const savedPhoto = saveResponse.data.response[0];
      return `photo${savedPhoto.owner_id}_${savedPhoto.id}`;
      
    } catch (error) {
      console.error('Error uploading photo to VK:', error);
      return null;
    }
  }

  /**
   * Подготовка опций публикации
   * @param {Object} options - Опции публикации
   * @returns {Object} Опции для API запроса
   */
  preparePublishOptions(options = {}) {
    const result = {};
    
    // Отложенная публикация (время в формате unixtime)
    if (options.publishDate) {
      result.publish_date = Math.floor(new Date(options.publishDate).getTime() / 1000);
    }
    
    // Публикация от имени группы (1) или от имени пользователя (0)
    if (options.fromGroup !== undefined) {
      result.from_group = options.fromGroup ? 1 : 0;
    } else {
      // По умолчанию публикуем от имени группы
      result.from_group = 1;
    }
    
    // Закрепить пост (1 - закрепить)
    if (options.pinned) {
      result.pinned = 1;
    }
    
    // Добавить геолокацию
    if (options.lat && options.long) {
      result.lat = options.lat;
      result.long = options.long;
    }
    
    // Маркировка как рекламы
    if (options.markedAsAds) {
      result.marked_as_ads = 1;
    }
    
    return result;
  }

  /**
   * Выполнение запроса на публикацию поста
   * @param {Object} postData - Данные поста
   * @param {string} token - Токен публикации
   * @returns {Promise<Object>} Результат публикации
   */
  async makeWallPostRequest(postData, token) {
    try {
      const response = await axios.post('https://api.vk.com/method/wall.post', null, {
        params: {
          ...postData,
          access_token: token,
          v: '5.131'
        }
      });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }
      
      return response.data.response;
    } catch (error) {
      console.error('Error making wall.post request:', error);
      throw error;
    }
  }

  /**
   * Обновление информации о посте после публикации
   * @param {Object} post - Пост из базы данных
   * @param {Object} vkResponse - Ответ от VK API
   * @param {string} communityId - ID сообщества
   * @returns {Promise<void>}
   */
  async updatePostAfterPublish(post, vkResponse, communityId) {
    try {
      // Добавляем информацию о публикации
      post.published = true;
      post.publishedAt = new Date();
      post.publishedTo = post.publishedTo || [];
      
      // Добавляем информацию о сообществе, если ещё не публиковали туда
      const alreadyPublished = post.publishedTo.some(p => p.communityId === communityId);
      if (!alreadyPublished) {
        post.publishedTo.push({
          communityId,
          postId: vkResponse.post_id,
          publishedAt: new Date()
        });
      }
      
      await post.save();
    } catch (error) {
      console.error('Error updating post after publish:', error);
    }
  }

  /**
   * Сохранение сгенерированного поста в базу данных
   * @param {Object} postData - Данные поста
   * @param {Object} vkResponse - Ответ от VK API
   * @param {string} communityId - ID сообщества
   * @param {string} taskId - ID задачи (опционально)
   * @returns {Promise<Document>} Сохраненный пост
   */
  async saveGeneratedPostToDatabase(postData, vkResponse, communityId, taskId = null) {
    try {
      // Создаем новый пост в базе данных
      const newPost = new Post({
        vkId: vkResponse.post_id,
        postId: vkResponse.post_id,
        communityId,
        taskId, // Может быть null
        text: postData.text || '',
        date: new Date(),
        likes: 0,
        reposts: 0,
        views: 0,
        comments: 0,
        attachments: postData.attachments || [],
        published: true,
        publishedAt: new Date(),
        createdAt: new Date(),
        lastUpdated: new Date(),
        generated: true, // Пометка, что пост был сгенерирован
        publishedTo: [{
          communityId,
          postId: vkResponse.post_id,
          publishedAt: new Date()
        }]
      });
      
      return await newPost.save();
    } catch (error) {
      console.error('Error saving generated post to database:', error);
      return null;
    }
  }
}

module.exports = new VkPostingService();
