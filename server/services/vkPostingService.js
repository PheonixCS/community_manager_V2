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
      // Update required permissions list to match our auth request
      const requiredScopes = ['wall', 'photos', 'groups', 'manage'];
      console.log(`Looking for token with these scopes: ${requiredScopes.join(', ')}`);
      
      // Get all active tokens first
      const allTokens = await vkAuthService.getAllTokens();
      const activeTokens = allTokens.filter(t => t.isActive && !t.isExpired());
      
      if (activeTokens.length === 0) {
        throw new Error('Нет активных токенов ВКонтакте. Необходимо авторизоваться в разделе "Авторизация ВКонтакте".');
      }
      
      console.log(`Found ${activeTokens.length} active tokens`);
      
      // Modified approach - be more permissive with required scopes
      // We'll accept any token that has at least wall rights - the most essential scope
      for (const token of activeTokens) {
        const tokenScopes = token.scope || [];
        console.log(`Token ${token.vkUserId} has scopes: ${tokenScopes.join(', ')}`);
        
        // If token has wall rights, use it right away
        if (tokenScopes.includes('wall')) {
          console.log(`Found token with wall access rights: ${token.vkUserId}`);
          
          // Update last used date
          token.lastUsed = new Date();
          await token.save();
          
          return token.accessToken;
        }
      }
      
      // If we get here, no token had wall rights
      throw new Error('Ни один из активных токенов не имеет прав доступа к стене (wall). Пожалуйста, удалите текущий токен и выполните авторизацию заново, предоставив все запрашиваемые разрешения.');
    } catch (error) {
      console.error('Error getting VK publish token:', error);
      throw error;
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
      
      console.log(`Attempting to upload photo from URL: ${photoUrl} to group ${communityId}`);
      
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
      
      console.log(`Got upload server: ${uploadServerResponse.data.response.upload_url}`);
      const uploadUrl = uploadServerResponse.data.response.upload_url;
      
      // 2. Скачиваем фото
      const photoResponse = await axios.get(photoUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 // Increase timeout for potentially slow image servers
      });
      
      // 3. Create proper FormData instance with binary data
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('photo', Buffer.from(photoResponse.data), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg'
      });
      
      // 4. Загружаем на сервер ВК
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      if (!uploadResponse.data || uploadResponse.data.error) {
        throw new Error(`VK Upload Error: ${uploadResponse.data?.error || 'Unknown upload error'}`);
      }
      
      console.log('Successfully uploaded photo to VK server');
      
      // 5. Сохраняем фото на стену
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
      console.log(`Successfully saved photo with ID: ${savedPhoto.id}`);
      
      return `photo${savedPhoto.owner_id}_${savedPhoto.id}`;
      
    } catch (error) {
      console.error('Error uploading photo to VK:', error);
      
      // Enhanced error logging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      
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
      console.log('Attempting wall.post request with data:', {
        owner_id: postData.owner_id,
        message_preview: postData.message ? postData.message.substring(0, 30) + '...' : '(no text)',
        has_attachments: !!postData.attachments
      });
      
      // Instead of passing everything as URL parameters, create form data for the body
      const formData = new URLSearchParams();
      
      // Add access token and API version to form data
      formData.append('access_token', token);
      formData.append('v', '5.131');
      
      // Add all post data parameters to form data
      for (const [key, value] of Object.entries(postData)) {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      }
      
      // Make POST request with form data in body instead of URL parameters
      const response = await axios.post('https://api.vk.com/method/wall.post', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (response.data.error) {
        console.error('VK API returned an error:', response.data.error);
        
        // Special handling for permission errors
        if (response.data.error.error_code === 15 || 
            (response.data.error.error_msg && response.data.error.error_msg.includes('access'))) {
          throw new Error(`Недостаточно прав для публикации поста. Необходимо повторно авторизоваться в ВКонтакте с правами на публикацию в группы. Ошибка API: ${response.data.error.error_msg}`);
        }
        
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }
      
      console.log('Successfully posted to wall, post ID:', response.data.response.post_id);
      return response.data.response;
    } catch (error) {
      console.error('Error making wall.post request:', error);
      
      // Enhance error message for permission issues
      if (error.message.includes('Access denied') || error.message.includes('permission')) {
        throw new Error('Недостаточно прав для публикации. Пожалуйста, удалите текущий токен и выполните авторизацию ВКонтакте заново, предоставив все запрашиваемые разрешения.');
      }
      
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
