const axios = require('axios');
const Settings = require('../models/Settings');
const Post = require('../models/Post');
const vkApiService = require('./vkApiService');
const vkAuthService = require('./vkAuthService');
const { postRepository } = require('../repositories');
const config = require('../config/config');

// Add the missing VK API version constant
const vkApiVersion = config.vk.apiVersion || '5.131';

/**
 * Сервис для публикации постов в сообщества ВКонтакте
 */
class VkPostingService {
  constructor() {
    // Queue for rate limiting photo uploads
    this.photoUploadQueue = [];
    this.isProcessingQueue = false;
    this.uploadDelay = 1000; // 1 second delay between photo uploads
    
    // Cache the config values for better performance
    this.s3PublicEndpoint = config.s3.publicEndpoint || 'http://krazu-group.tech:9000';
    
    console.log(`VK Posting Service initialized with API version ${vkApiVersion}`);
    console.log(`Using S3 public endpoint: ${this.s3PublicEndpoint}`);
  }

  /**
   * Получить токен публикации для постинга
   * @returns {Promise<string|null>} Токен публикации или null
   */
  async getPublishToken() {
    try {
      const requiredScopes = ['wall', 'photos', 'groups', 'manage'];
      console.log(`Looking for token with these scopes: ${requiredScopes.join(', ')}`);
      
      // Получаем токены через vkAuthService для единообразия
      const allTokens = await vkAuthService.getAllTokens();
      const activeTokens = allTokens.filter(t => t.isActive && !t.isExpired());
      
      if (activeTokens.length === 0) {
        throw new Error('Нет активных токенов ВКонтакте. Необходимо авторизоваться в разделе "Авторизация ВКонтакте".');
      }
      
      console.log(`Found ${activeTokens.length} active tokens`);
      
      // Ищем токены с правами wall и manage
      for (const token of activeTokens) {
        const tokenScopes = token.scope || [];
        console.log(`Token ${token.vkUserId} has scopes: ${Array.isArray(tokenScopes) ? tokenScopes.join(', ') : tokenScopes}`);
        
        // Проверяем наличие обоих прав: wall и manage
        if ((Array.isArray(tokenScopes) && tokenScopes.includes('wall') && tokenScopes.includes('manage')) ||
            (typeof tokenScopes === 'string' && tokenScopes.includes('wall') && tokenScopes.includes('manage'))) {
          console.log(`Found token with wall+manage access rights: ${token.vkUserId}`);
          
          // Обновляем дату последнего использования
          token.lastUsed = new Date();
          await token.save();
          
          // Возвращаем строку токена для совместимости
          return token.accessToken;
        }
      }
      
      // Если подходящий токен не найден, выбираем первый активный как запасной вариант
      console.warn('No token with both wall and manage permissions found. Using first active token.');
      
      // Обновляем дату последнего использования
      activeTokens[0].lastUsed = new Date();
      await activeTokens[0].save();
      
      return activeTokens[0].accessToken;
    } catch (error) {
      console.error('Error getting VK publish token:', error);
      throw error;
    }
  }

  /**
   * Queue photo upload with rate limiting
   * @param {string} photoUrl - URL of the photo
   * @param {string} token - Access token
   * @param {string} communityId - Community ID
   * @returns {Promise<string|null>} Photo attachment string or null
   */
  queuePhotoUpload(photoUrl, token, communityId) {
    return new Promise((resolve, reject) => {
      this.photoUploadQueue.push({
        photoUrl,
        token,
        communityId,
        resolve,
        reject
      });
      
      // Start processing the queue if not already processing
      if (!this.isProcessingQueue) {
        this.processPhotoUploadQueue();
      }
    });
  }

  /**
   * Process the photo upload queue with rate limiting
   */
  async processPhotoUploadQueue() {
    if (this.photoUploadQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
    
    this.isProcessingQueue = true;
    const { photoUrl, token, communityId, resolve, reject } = this.photoUploadQueue.shift();
    
    try {
      // Try to upload the photo with retries
      const result = await this.uploadPhotoToVkWithRetry(photoUrl, token, communityId);
      resolve(result);
    } catch (error) {
      reject(error);
    }
    
    // Wait before processing next item
    setTimeout(() => {
      this.processPhotoUploadQueue();
    }, this.uploadDelay);
  }

  /**
   * Публикация существующего поста из базы данных
   * @param {string|Object} postIdOrData - ID поста в базе данных или объект с данными поста
   * @param {string} communityId - ID сообщества ВК (формат: -12345)
   * @param {Object} options - Дополнительные опции публикации
   * @param {string} [originalPostId] - ID оригинального поста для обновления в БД (нужен, если первый параметр - объект)
   * @returns {Promise<Object>} Результат публикации
   */
  async publishExistingPost(postIdOrData, communityId, options = {}, originalPostId = null) {
    try {
      let post;
      let postId;
      let postText;
      let attachments;
      let isCarousel = false;
      let userAddedMedia = false;
      
      // Проверяем, передан ли пост как объект или как ID
      if (typeof postIdOrData === 'object') {
        // Пост передан в виде объекта - использовать напрямую
        post = postIdOrData;
        postId = originalPostId || post._id;
        postText = post.text || '';
        attachments = post.attachments;
        
        // Проверяем, добавлены ли медиа пользователем
        if (originalPostId) {
          const originalPost = await Post.findById(originalPostId);
          if (originalPost && post.attachments) {
            // Если количество вложений увеличилось, значит пользователь добавил медиа
            userAddedMedia = post.attachments.length > originalPost.attachments.length;
            if (userAddedMedia) {
              console.log('User added media to post, will use carousel mode');
            }
          }
        }
        
        isCarousel = post.isCarousel || userAddedMedia;
        console.log(`Publishing modified post (isCarousel: ${isCarousel}) to community ${communityId}`);
      } else {
        // Передан ID поста - загрузить из базы
        postId = postIdOrData;
        console.log(`Publishing post with ID ${postId} to community ${communityId}`);
        
        // Получаем пост из базы данных
        post = await Post.findById(postId);
        if (!post) {
          throw new Error(`Post with ID ${postId} not found`);
        }
        
        postText = post.text || '';
        attachments = post.attachments;
        isCarousel = post.isCarousel;

        console.log(`isCarousel: ${isCarousel}`);
        console.log(`post: ${post._id}`);
        
        // Apply transformations from the options (для обратной совместимости)
        if (options.removeHashtags) {
          postText = postText.replace(/#[\wа-яА-ЯёЁ]+/g, '').replace(/\s+/g, ' ').trim();
        }
        
        if (options.transliterate) {
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
          
          postText = postText.split('').map(char => translitMap[char] || char).join('');
        }
      }
      
      // 1. Получаем токен публикации
      const token = await this.getPublishToken();
      if (!token) {
        throw new Error('Failed to get publish token. Authorize VK user first.');
      }
      
      // 3. Подготавливаем данные для публикации
      const postData = {
        owner_id: communityId, // ID сообщества со знаком минус
        message: postText,
        // Добавляем attachments, если есть
        attachments: await this.prepareAttachments(attachments, token, communityId, post),
        // Добавляем внутренние метаданные для использования в makeWallPostRequest
        _post: post,
        _isCarousel: isCarousel,
        _photosCount: attachments ? attachments.filter(a => a.type === 'photo').length : 0,
        _mediaAdded: userAddedMedia,
        // Применяем опции публикации
        ...this.preparePublishOptions(options)
      };
      
      // 4. Публикуем пост через VK API
      const result = await this.makeWallPostRequest(postData, token);
      
      // 5. Если опция pinned установлена, закрепляем пост
      if (options.pinned) {
        try {
          await this.pinPost(result.post_id, communityId, token);
        } catch (pinError) {
          console.error(`Error pinning post ${result.post_id}:`, pinError);
          // Не прерываем процесс, если закрепление не удалось
        }
      }
      
      // 6. Обновляем информацию о посте в базе данных только если пост был из БД
      // (идентифицируем это наличием метода save)
      if (postId) {
        // Получаем оригинальный пост из базы если нам передали объект с модификациями
        if (typeof postIdOrData === 'object' && originalPostId) {
          post = await Post.findById(originalPostId);
          if (!post) {
            console.warn(`Original post with ID ${originalPostId} not found for updating`);
          }
        }
        
        // Обновляем информацию только если нашли пост в БД
        if (post && typeof post.save === 'function') {
          await this.updatePostAfterPublish(post, result, communityId);
        }
      }
      
      return {
        status: 'success',
        postId: result.post_id,
        message: `Post successfully published to VK community ${communityId}`,
        vkUrl: `https://vk.com/wall${communityId}_${result.post_id}`
      };
      
    } catch (error) {
      console.error('Error publishing post:', error);
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Публикация сгенерированного контента
   * @param {Object} content - Сгенерированный контент для публикации
   * @param {string} ownerId - ID сообщества (с префиксом -)
   * @param {Object} options - Опции публикации
   * @returns {Promise<Object>} Результат публикации
  */
  async publishGeneratedPost(content, ownerId, options = {}) {
    try {
      console.log(`Publishing generated content to ${ownerId}`);
      
      // Получаем токен из опций или через стандартный метод
      
      // 1. Получаем токен публикации
      let tokenString = await this.getPublishToken();
      if (!tokenString) {
        throw new Error('Failed to get publish token. Authorize VK user first.');
      }
      // console.log(tokenString);
      // return;
      
      
      // Проверяем наличие текста или вложений
      if ((!content.text || content.text.trim() === '') && 
          (!content.attachments || content.attachments.length === 0)) {
        throw new Error('No content to publish (text or attachments)');
      }
      
      // Инициализируем результат
      const result = {
        status: 'pending',
        ownerId: ownerId,
        attachments: []
      };
      
      // Список ключей S3 для последующей очистки
      const s3KeysToClean = [];
      
      // Загружаем фотографии, если они есть
      if (content.attachments && content.attachments.length > 0) {
        const photoAttachments = content.attachments.filter(a => a.type === 'photo');
        
        if (photoAttachments.length > 0) {
          console.log(`Processing ${photoAttachments.length} photo attachments`);
          
          for (const attachment of photoAttachments) {
            if (attachment.url) {
              // Добавляем ключ S3 для очистки если он есть
              if (attachment.s3Key) {
                s3KeysToClean.push(attachment.s3Key);
              }
              
              try {
                // Преобразуем локальные URLs в публичные
                const publicUrl = this.convertLocalUrlToPublic(attachment.url);
                console.log(`Uploading photo from URL: ${publicUrl}`);
                
                // Загружаем фотографию в ВКонтакте
                const photoResult = await this.uploadPhotoToVkWithRetry(publicUrl, tokenString, ownerId);
                
                if (photoResult && photoResult.attachment) {
                  result.attachments.push(photoResult.attachment);
                  console.log(`Successfully uploaded photo: ${photoResult.attachment}`);
                }
              } catch (uploadError) {
                console.error(`Error uploading photo ${attachment.url}:`, uploadError);
                // Продолжаем с другими фото в случае ошибки
              }
            }
          }
        }
      }
      
      // Публикуем пост с текстом и загруженными вложениями
      const attachmentsString = result.attachments.join(',');
      
      // Формируем данные для запроса
      const postData = {
        owner_id: ownerId,
        message: content.text || '',
        // from_group: options.fromGroup !== false ? 1 : 0,
        // close_comments: options.closeComments ? 1 : 0,
        // mark_as_ads: options.markedAsAds ? 1 : 0
        _isCarousel: content.isCarousel
      };
      
      // Добавляем отложенную публикацию, если указана
      if (options.publishDate) {
        postData.publish_date = Math.floor(new Date(options.publishDate).getTime() / 1000);
      }
      
      // Добавляем вложения, если есть
      if (result.attachments.length > 0) {
        postData.attachments = attachmentsString;
      }
      // console.log(`full content:`);
      // console.log(content);
      // Включаем режим карусели, если это указано в content или если несколько фото
      // if ((content.isCarousel || result.attachments.length > 1) && result.attachments.length > 0) {
      //   postData.primary_attachments_mode = 'carousel';
      //   console.log('Using carousel mode for attachments');
      // }
      
      // console.log(`Attempting wall.post request with data:`, {
      //   owner_id: postData.owner_id,
      //   message_preview: postData.message ? `${postData.message.substring(0, 20)}...` : '(no text)',
      //   has_attachments: result.attachments.length > 0,
      //   attachment_count: result.attachments.length
      // });
      
      // Отправляем запрос на публикацию поста
      // const formData = new URLSearchParams();
      
      // // Добавляем все параметры в form data
      // for (const [key, value] of Object.entries(postData)) {
      //   formData.append(key, value);
      // }
      
      // 4. Публикуем пост через VK API
      result = await this.makeWallPostRequest(postData, token);
      
      // 5. Если опция pinned установлена, закрепляем пост
      if (options.pinned) {
        try {
          await this.pinPost(result.post_id, communityId, token);
        } catch (pinError) {
          console.error(`Error pinning post ${result.post_id}:`, pinError);
          // Не прерываем процесс, если закрепление не удалось
        }
      }
      
      // Успешная публикация
      console.log(`Successfully posted to wall, post ID: ${result.post_id}`);
      result.status = 'success';
      result.postId = result.post_id;
      result.vkUrl = `https://vk.com/wall${ownerId}_${result.post_id}`;
      
      // Если нужно закрепить пост
      // if (options.pinned) {
      //   try {
      //     await this.pinPost(response.data.response.post_id, ownerId, tokenString);
      //   } catch (pinError) {
      //     console.error(`Error pinning post ${response.data.response.post_id}:`, pinError);
      //     // Не прерываем процесс, если закрепление не удалось
      //   }
      // }
      
      // Сохраняем в базу данных, если это указано в опциях
      if (options.saveToDatabase) {
        try {
          const savedPost = await this.saveGeneratedPostToDatabase(
            content, 
            result, 
            ownerId,
            options.taskId
          );
          
          if (savedPost) {
            result.savedPost = {
              id: savedPost._id,
              message: 'Post also saved to database'
            };
          }
        } catch (dbError) {
          console.error('Error saving generated post to database:', dbError);
        }
      }
      
      // Очистка временных файлов в S3
      if (s3KeysToClean.length > 0) {
        try {
          await this.cleanupS3Files(s3KeysToClean);
        } catch (cleanupError) {
          console.error('Error cleaning up S3 files:', cleanupError);
          // Не прерываем выполнение, так как пост уже опубликован
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Error publishing generated content:', error);
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
  async prepareAttachments(attachments, token, communityId, post = null) {
    if (!attachments || attachments.length === 0) {
      return '';
    }
    
    // Здесь будем собирать строки для attachments
    const attachmentStrings = [];
    
    console.log(`Preparing ${attachments.length} attachments for publication, post ID: ${post?._id || 'unknown'}`);
    
    // Проверяем наличие скачанных медиа
    const hasDownloadedVideos = post && post.downloadedVideos && post.downloadedVideos.length > 0;
    const hasMediaDownloads = post && post.mediaDownloads && post.mediaDownloads.length > 0;
    
    // Определяем, нужен ли режим карусели для поста
    const isCarousel = post && post.isCarousel;
    if (isCarousel) {
      console.log(`Post is marked as carousel. Will use carousel mode for publishing.`);
    }
    
    // Подсчитываем количество изображений для определения необходимости карусели
    const photoAttachments = attachments.filter(a => a.type === 'photo').length;
    console.log(`Post has ${photoAttachments} photo attachments`);
    
    if (hasDownloadedVideos) {
      console.log(`Post has ${post.downloadedVideos.length} downloaded videos`);
    }
    
    if (hasMediaDownloads) {
      console.log(`Post has ${post.mediaDownloads.length} media downloads`);
    }
    
    // Обрабатываем каждый тип вложений
    for (const attachment of attachments) {
      try {
        if (attachment.type === 'photo') {
          // Определим лучший URL для фотографии в порядке приоритета:
          let bestPhotoUrl = null;
          
          // 1. Проверяем наличие фото в mediaDownloads
          if (hasMediaDownloads) {
            // Ищем по ID конкретного фото
            const photoId = attachment.photo?.id?.toString();
            const photoMedia = post.mediaDownloads.find(m => 
              m.type === 'photo' && m.mediaId === photoId
            );
            
            if (photoMedia && photoMedia.s3Url) {
              // Конвертируем локальный URL в публичный для загрузки
              bestPhotoUrl = this.convertLocalUrlToPublic(photoMedia.s3Url);
              console.log(`Using high quality S3 photo for ID ${photoId}: ${bestPhotoUrl}`);
            }
          }
          
          // 2. Если нет в mediaDownloads, ищем наилучшее качество из sizes
          if (!bestPhotoUrl && attachment.photo?.sizes && attachment.photo.sizes.length > 0) {
            // Сортируем sizes по убыванию размера (большие сначала)
            const sortedSizes = [...attachment.photo.sizes].sort((a, b) => {
              if (a.width && a.height && b.width && b.height) {
                return (b.width * b.height) - (a.width * a.height);
              }
              return 0;
            });
            
            bestPhotoUrl = sortedSizes[0].url;
            console.log(`Using best quality VK photo: ${sortedSizes[0].width}x${sortedSizes[0].height}`);
          }
          
          // 3. Если не нашли лучшее фото, используем старую логику
          if (!bestPhotoUrl) {
            bestPhotoUrl = attachment.url || attachment.photo?.url || attachment.photo?.sizes?.[0]?.url;
            console.log(`Using fallback photo URL: ${bestPhotoUrl}`);
          }
          
          if (bestPhotoUrl) {
            const photoAttachment = await this.queuePhotoUpload(bestPhotoUrl, token, communityId);
            if (photoAttachment) {
              attachmentStrings.push(photoAttachment);
            }
          }
        }
        else if (attachment.type === 'video') {
          console.log(`Processing video attachment: ${attachment.video?.id || 'unknown'}`);
          
          // Определяем лучший источник видео
          let videoAttachment = null;
          
          // 1. Сначала проверяем наличие в downloadedVideos (обратная совместимость)
          if (hasDownloadedVideos) {
            const videoId = attachment.video?.id?.toString();
            const downloadedVideo = post.downloadedVideos.find(v => v.videoId === videoId);
            
            if (downloadedVideo && downloadedVideo.s3Url) {
              console.log(`Found downloaded video in downloadedVideos: ${downloadedVideo.s3Url}`);
              
              // Используем оригинальное видео из ВК вместо загрузки своего
              if (attachment.video?.owner_id && attachment.video?.id) {
                console.log(`Using original VK video instead of uploading: ${attachment.video.owner_id}_${attachment.video.id}`);
                attachmentStrings.push(`video${attachment.video.owner_id}_${attachment.video.id}`);
                continue;
              }
            }
          }
          
          // 2. Затем проверяем mediaDownloads (новый формат)
          if (!videoAttachment && hasMediaDownloads) {
            const videoId = attachment.video?.id?.toString();
            const videoMedia = post.mediaDownloads.find(m => 
              m.type === 'video' && m.mediaId === videoId
            );
            
            if (videoMedia && videoMedia.s3Url) {
              console.log(`Found downloaded video in mediaDownloads: ${videoMedia.s3Url}`);
              
              // Используем оригинальное видео из ВК вместо загрузки своего
              if (attachment.video?.owner_id && attachment.video?.id) {
                console.log(`Using original VK video instead of uploading: ${attachment.video.owner_id}_${attachment.video.id}`);
                attachmentStrings.push(`video${attachment.video.owner_id}_${attachment.video.id}`);
                continue;
              }
            }
          }
          
          // 3. Если скачанное видео не нашли или решили не загружать, используем исходное из ВК
          if (attachment.video?.owner_id && attachment.video?.id) {
            console.log(`Using original VK video: ${attachment.video.owner_id}_${attachment.video.id}`);
            attachmentStrings.push(`video${attachment.video.owner_id}_${attachment.video.id}`);
          }
        }
        else if (attachment.type === 'doc') {
          // Для документов можно использовать существующие ID или загружать новые
          if (attachment.doc?.owner_id && attachment.doc?.id) {
            attachmentStrings.push(`doc${attachment.doc.owner_id}_${attachment.doc.id}`);
          }
        }
        else if (attachment.type === 'audio') {
          // Для аудио можно использовать существующие ID или загружать новые
          if (attachment.audio?.owner_id && attachment.audio?.id) {
            attachmentStrings.push(`audio${attachment.audio.owner_id}_${attachment.audio.id}`);
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
   * Upload photo to VK with retry mechanism
   * @param {string} photoUrl - Photo URL
   * @param {string} token - Access token
   * @param {string} communityId - Community ID
   * @returns {Promise<string|null>} Photo attachment string or null
   */
  async uploadPhotoToVkWithRetry(photoUrl, token, communityId, retryCount = 3, retryDelay = 2000) {
    let lastError = null;
    
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        return await this.uploadPhotoToVk(photoUrl, token, communityId);
      } catch (error) {
        lastError = error;
        console.log(`Photo upload attempt ${attempt + 1}/${retryCount} failed: ${error.message}`);
        
        // Check if we should retry based on error type
        const shouldRetry = error.message.includes('Too many requests per second') ||
                            error.message.includes('Internal server error') ||
                            error.response?.status === 500;
        
        if (!shouldRetry) {
          console.log(`Error doesn't seem retryable, breaking retry loop`);
          break;
        }
        
        // Wait before next attempt - use exponential backoff
        const waitTime = retryDelay * Math.pow(2, attempt);
        console.log(`Waiting ${waitTime}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    console.error(`Failed to upload photo after ${retryCount} attempts`, lastError);
    // Return null to indicate failure
    return null;
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
      
      // Преобразуем локальный URL в публичный, если это URL из S3
      const publicPhotoUrl = this.convertLocalUrlToPublic(photoUrl);
      console.log(`Attempting to upload photo from URL: ${publicPhotoUrl} to group ${communityId}`);
      
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
      const photoResponse = await axios.get(publicPhotoUrl, { 
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
      
      // Проверяем наличие необходимых полей в ответе
      if (!uploadResponse.data.photo || uploadResponse.data.photo === 'null' || uploadResponse.data.photo === '') {
        console.error('Invalid photo in upload response:', uploadResponse.data);
        throw new Error('VK Upload Error: Invalid photo data in response');
      }
      
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
      
      if (!saveResponse.data.response || !saveResponse.data.response[0]) {
        console.error('Empty response from photos.saveWallPhoto:', saveResponse.data);
        throw new Error('Empty response when saving photo');
      }
      
      const savedPhoto = saveResponse.data.response[0];
      console.log(`Saved Photos`)
      console.log(`Successfully saved photo with ID: ${savedPhoto.id}`);
      
      return `photo${savedPhoto.owner_id}_${savedPhoto.id}`;
      
    } catch (error) {
      console.error('Error uploading photo to VK:', error);
      
      // Enhanced error logging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      
      throw error;
    }
  }

  /**
   * Загрузка видео в ВКонтакте
   * @param {string} videoUrl - URL видео (из S3)
   * @param {string} token - Токен доступа
   * @param {string} communityId - ID сообщества
   * @param {string} title - Название видео
   * @param {string} description - Описание видео
   * @returns {Promise<string|null>} Строка с ID видео для VK API
  */
  async uploadVideoToVk(videoUrl, token, communityId, title = '', description = '') {
    try {
      // VK не поддерживает загрузку видео для attachments.
      // Всегда используем оригинальное видео из ВК, если оно доступно
      
      // Извлекаем ID из URL, если это возможно
      if (videoUrl.includes('video_')) {
        const matches = videoUrl.match(/video_(-?\d+)_(\d+)/);
        if (matches && matches[1] && matches[2]) {
          const ownerId = matches[1];
          const videoId = matches[2];
          console.log(`Using original VK video from URL: ${ownerId}_${videoId}`);
          return `video${ownerId}_${videoId}`;
        }
      }
      
      // Если не удалось извлечь ID из URL, логируем ошибку
      console.log(`Cannot determine video ID from URL: ${videoUrl}, video may not appear in post`);
      return null;
      
      // Примечание: код ниже не выполнится, так как VK API не принимает загруженные видео в attachments
      // Оставляем для справки на случай, если API изменится
      
      /*
      const publicVideoUrl = this.convertLocalUrlToPublic(videoUrl);
      // ...rest of the original implementation...
      */
    } catch (error) {
      console.error('Error processing video attachment:', error);
      
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      
      return null;
    }
  }
  
  /**
   * Преобразует локальный URL S3 в публичный URL
   * @param {string} url - Исходный URL
   * @returns {string} Публичный URL
  */
  convertLocalUrlToPublic(url) {
    if (!url) return url;
    
    // Use the cached public endpoint from constructor
    const publicEndpoint = this.s3PublicEndpoint;
    
    // Если URL уже использует публичный эндпоинт, возвращаем как есть
    if (url.includes('krazu-group.tech') || url.includes(publicEndpoint)) {
      return url;
    }
    
    // Проверяем, является ли URL локальным URL для MinIO/S3
    if (url.includes('localhost:9000') || url.includes('127.0.0.1:9000')) {
      // Заменяем локальный хост на публичный эндпоинт
      return url.replace(/http:\/\/(localhost|127\.0\.0\.1):9000/, publicEndpoint);
    }
    
    // Если это путь к S3 без явного указания хоста (например, из mediaDownloads.s3Url)
    if (url.startsWith('/vk-media/') || url.startsWith('vk-media/')) {
      const bucketPath = url.startsWith('/') ? url : `/${url}`;
      return `${publicEndpoint}${bucketPath}`;
    }
    
    // Log problematic URLs for debugging
    console.log(`Could not convert URL to public format: ${url}`);
    
    // Если не удалось распознать URL, возвращаем исходный
    return url;
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
    
    // Закрепить пост - сохраняем это значение, но применяем отдельно
    // через wall.pin после публикации поста
    // if (options.pinned) {
    //   result.pinned = 1;
    // }
    
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
      
      // Check if message is very long and truncate temporarily to log
      if (postData.message && postData.message.length > 1000) {
        console.log(`Message length is ${postData.message.length} characters (first 100 characters):`);
        console.log(postData.message.substring(0, 100) + '...');
      }
      
      // Instead of passing everything as URL parameters, create form data for the body
      const formData = new URLSearchParams();
      
      // Add access token and API version to form data
      formData.append('access_token', token);
      formData.append('v', '5.131');
      formData.append('from_group', '1');
      
      // Определяем, нужно ли использовать режим карусели
      // Используем carousel_mode, если:
      // 1. У поста установлен флаг isCarousel
      // 2. В посте более одного фото
      const useCarouselMode = 
        (postData._post && postData._post.isCarousel) || 
        (postData._photosCount && postData._photosCount > 1) ||
        (postData._mediaAdded);
        
      if (useCarouselMode) {
        console.log('Using carousel mode for post publishing');
        formData.append('primary_attachments_mode', 'carousel');
      }
      
      // Add all post data parameters to form data
      for (const [key, value] of Object.entries(postData)) {
        // Skip our internal properties that start with _
        if (!key.startsWith('_') && value !== undefined && value !== null) {
          formData.append(key, value);
        }
      }
      
      // Remove the pinned parameter - we'll handle pinning separately
      if (formData.has('pinned')) {
        formData.delete('pinned');
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
        if (response.data.error.error_code === 15) {
          // Error 15 is insufficient permissions
          let errorMsg = 'Недостаточно прав для публикации поста.';
          
          // Check specific error subcodes
          if (response.data.error.error_subcode === 1133) {
            errorMsg = 'Отсутствуют права manage для публикации в сообществах. Необходимо повторно авторизоваться в ВКонтакте, предоставив все запрашиваемые разрешения.';
          }
          
          throw new Error(`${errorMsg} Ошибка API: ${response.data.error.error_msg}`);
        }
        
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }
      
      console.log('Successfully posted to wall, post ID:', response.data.response.post_id);
      return response.data.response;
    } catch (error) {
      console.error('Error making wall.post request:', error);
      
      // Enhance error message for permission issues
      if (error.message.includes('Access denied') || 
          error.message.includes('permission') || 
          error.message.includes('access')) {
        throw new Error('Недостаточно прав для публикации. Пожалуйста, удалите текущий токен и выполните авторизацию ВКонтакте заново, предоставив все запрашиваемые разрешения (особенно "Управление сообществом" и "Доступ к стене").');
      }
      
      throw error;
    }
  }

  /**
   * Закрепляет пост на стене сообщества
   * @param {string} postId - ID поста в формате VK (числовой ID)
   * @param {string} communityId - ID сообщества (с минусом в начале)
   * @param {string} token - Токен доступа
   * @returns {Promise<boolean>} Результат операции
   */
  async pinPost(postId, communityId, token) {
    try {
      console.log(`Pinning post ${postId} in community ${communityId}`);
      
      const formData = new URLSearchParams();
      formData.append('access_token', token);
      formData.append('v', '5.131');
      formData.append('owner_id', communityId);
      formData.append('post_id', postId);
      
      const response = await axios.post('https://api.vk.com/method/wall.pin', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (response.data.error) {
        console.error('VK API returned an error when pinning post:', response.data.error);
        throw new Error(`Error pinning post: ${response.data.error.error_msg}`);
      }
      
      console.log(`Successfully pinned post ${postId} in community ${communityId}`);
      return true;
    } catch (error) {
      console.error(`Error pinning post ${postId} in community ${communityId}:`, error);
      return false;
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

  // Add cleanup for S3 images after publishing

  // /**
  //  * Публикация сгенерированного контента
  //  * @param {Object} content - Сгенерированный контент для публикации
  //  * @param {string} ownerId - ID сообщества (с префиксом -)
  //  * @param {Object} options - Опции публикации
  //  * @returns {Promise<Object>} Результат публикации
  //  */
  // async publishGeneratedPost(content, ownerId, options = {}) {
  //   try {
  //     // Проверяем наличие токена
  //     const token = await vkAuthService.getActiveToken(['wall', 'photos', 'groups']);
      
  //     if (!token) {
  //       throw new Error('Не найден активный токен ВКонтакте');
  //     }
  
  //     // Проверяем наличие текста или вложений
  //     if ((!content.text || content.text.trim() === '') && 
  //         (!content.attachments || content.attachments.length === 0)) {
  //       throw new Error('Нет контента для публикации (текст или вложения)');
  //     }
      
  //     // Инициализируем результат
  //     const result = {
  //       status: 'pending',
  //       ownerId: ownerId,
  //       attachments: []
  //     };
  
  //     // Список ключей S3 для последующей очистки
  //     const s3KeysToClean = [];
  
  //     // Загружаем фотографии, если есть
  //     if (content.attachments && content.attachments.length > 0) {
  //       const photoAttachments = content.attachments.filter(a => a.type === 'photo');
        
  //       if (photoAttachments.length > 0) {
  //         // Собираем URL'ы фотографий для загрузки
  //         for (const attachment of photoAttachments) {
  //           if (attachment.url) {
  //             // Добавляем ключ S3 для очистки если он есть
  //             if (attachment.s3Key) {
  //               s3KeysToClean.push(attachment.s3Key);
  //             }
  
  //             // Загружаем фотографию в ВК
  //             console.log(`Token: ${token}`);
  //             await this.uploadPhotoToVkWithRetry(attachment.url, ownerId, token.accessToken, result);
  //           }
  //         }
  //       }
  //     }
  
  //     // Публикуем пост с текстом и загруженными вложениями
  //     const attachmentsString = result.attachments.join(',');
      
  //     // Устанавливаем опции публикации по умолчанию
  //     const publishOptions = {
  //       from_group: options.fromGroup !== false ? 1 : 0,
  //       close_comments: options.closeComments ? 1 : 0,
  //       mark_as_ads: options.markedAsAds ? 1 : 0
  //     };
      
      
      
  //     // Формируем данные для запроса
  //     const postData = {
  //       owner_id: ownerId,
  //       message: content.text || '',
  //       ...publishOptions
  //     };

  //     // Добавляем опцию карусели, если несколько вложений
  //     if (content.isCarousel && result.attachments.length > 1) {
  //       // publishOptions.primary_attachments_mode = 'carousel';
  //       formData.append('primary_attachments_mode', 'carousel');
  //     }

      
  //     // Добавляем вложения, если есть
  //     if (result.attachments.length > 0) {
  //       postData.attachments = attachmentsString;
  //     }
      
  //     // Для отладки
  //     console.log(`Attempting wall.post request with data: ${JSON.stringify({
  //       owner_id: postData.owner_id,
  //       message_preview: postData.message ? `${postData.message.substring(0, 20)}...` : 'No message',
  //       has_attachments: result.attachments.length > 0,
  //       primary_attachments_mode: postData.primary_attachments_mod
  //     }, null, 2)}`);
  
  //     // Добавляем логирование длины сообщения
  //     if (content.text) {
  //       console.log(`Message length is ${content.text.length} characters (first 100 characters):\n${content.text.substring(0, 100)}...`);
  //     }
      
  //     // Отправляем запрос на публикацию поста
  //     const response = await axios.get('https://api.vk.com/method/wall.post', {
  //       params: {
  //         ...postData,
  //         access_token: token.accessToken,
  //         v: vkApiVersion
  //       }
  //     });
      
  //     if (response.data.error) {
  //       throw new Error(`ВКонтакте API error: ${response.data.error.error_msg}`);
  //     }
      
  //     // Успешная публикация
  //     console.log(`Successfully posted to wall, post ID: ${response.data.response.post_id}`);
  //     result.status = 'success';
  //     result.postId = response.data.response.post_id;
  //     result.vkUrl = `https://vk.com/wall${ownerId}_${response.data.response.post_id}`;
      
  //     // Сохраняем в базу данных, если это указано в опциях
  //     if (options.saveToDatabase) {
  //       try {
  //         // ...existing code for saving to database...
  //       } catch (dbError) {
  //         console.error('Error saving generated post to database:', dbError);
  //       }
  //     }
  
  //     // Очистка временных файлов в S3
  //     if (s3KeysToClean.length > 0) {
  //       try {
  //         this.cleanupS3Files(s3KeysToClean);
  //       } catch (cleanupError) {
  //         console.error('Error cleaning up S3 files:', cleanupError);
  //         // Не прерываем выполнение, так как пост уже опубликован
  //       }
  //     }
      
  //     return result;
  //   } catch (error) {
  //     console.error('Error publishing generated content:', error);
  //     return {
  //       status: 'error',
  //       error: error.message
  //     };
  //   }
  // }

  /**
   * Очистка временных файлов в S3
   * @param {Array<string>} s3Keys - Массив ключей S3 для удаления
   */
  async cleanupS3Files(s3Keys) {
    try {
      console.log(`Cleaning up ${s3Keys.length} temporary S3 files...`);
      const s3Service = require('./s3Service');
      
      // Удаляем файлы по одному
      for (const key of s3Keys) {
        try {
          const result = await s3Service.deleteFile(key);
          if (result.success) {
            console.log(`Successfully deleted S3 file: ${key}`);
          } else {
            console.warn(`Failed to delete S3 file: ${key}`, result.error);
          }
        } catch (deleteError) {
          console.error(`Error deleting S3 file ${key}:`, deleteError);
        }
      }
    } catch (error) {
      console.error('Error in S3 cleanup:', error);
      throw error;
    }
  }

  /**
   * Загрузка фотографии в ВКонтакте с повторными попытками
   * @param {string} photoUrl - URL фотографии
   * @param {string} ownerId - ID сообщества
   * @param {string} token - Токен доступа
   * @param {Object} result - Объект для обновления результатами
   */
  async uploadPhotoToVkWithRetry(photoUrl, ownerId, token, result) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Photo upload attempt ${attempt}/${maxRetries} for ${photoUrl}`);
        
        // Проверка, что URL действительно корректный
        if (!photoUrl.startsWith('http://') && !photoUrl.startsWith('https://')) {
          throw new Error(`Invalid URL format: ${photoUrl}`);
        }
        
        const uploadResult = await this.uploadPhotoToVk(photoUrl, ownerId, token);
        result.attachments.push(uploadResult.attachment);
        
        console.log(`Photo upload successful on attempt ${attempt}: ${uploadResult.attachment}`);
        return uploadResult; // Успешно загрузили фото, возвращаем результат
      } catch (error) {
        lastError = error;
        console.error(`Photo upload attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          console.error("Error doesn't seem retryable, breaking retry loop");
          break;
        }
        
        // Экспоненциальная задержка между попытками
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Если все попытки неудачны, выбрасываем исключение
    console.error(`Failed to upload photo after ${maxRetries} attempts`, lastError);
    throw lastError || new Error('Unknown error during photo upload');
  }

  // Метод проверки, можно ли повторить запрос при ошибке
  isRetryableError(error) {
    // Сетевые ошибки, ошибки времени ожидания и некоторые ошибки ВК API можно повторять
    const retryStatuses = [429, 500, 502, 503, 504]; // Too many requests, server errors
    const retryMessages = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'Too many requests',
      'Internal server error',
      'Bad gateway',
      'Service unavailable',
      'Gateway timeout',
      'Too many requests per second'
    ];
    
    // Проверка кода статуса
    if (error.response && retryStatuses.includes(error.response.status)) {
      return true;
    }
    
    // Проверка сообщения об ошибке
    if (error.message) {
      return retryMessages.some(msg => error.message.includes(msg));
    }
    
    return false; // По умолчанию считаем, что ошибку нельзя повторять
  }

  /**
   * Загрузка фотографии в ВКонтакте
   * @param {string} photoUrl - URL фотографии
   * @param {string} ownerId - ID сообщества
   * @param {string} token - Токен доступа
   * @returns {Promise<Object>} Результат загрузки
   */
  async uploadPhotoToVk(photoUrl, ownerId, token) {
    try {
      // Add debug log
      console.log(`Starting photo upload to VK. URL: ${photoUrl}, Community ID: ${ownerId}`);
      
      // Step 1: Get server for photo upload
      const serverResponse = await axios.get('https://api.vk.com/method/photos.getWallUploadServer', {
        params: {
          group_id: Math.abs(parseInt(ownerId)).toString(), // VK requires positive ID without the minus
          access_token: token,
          v: vkApiVersion // Use the defined constant
        }
      });
      
      if (serverResponse.data.error) {
        throw new Error(`VK API error: ${serverResponse.data.error.error_msg}`);
      }
      
      const uploadUrl = serverResponse.data.response.upload_url;
      console.log(`Got upload server URL: ${uploadUrl}`);
      
      // Step 2: Download the image from URL and upload to VK server
      console.log(`Downloading image from: ${photoUrl}`);
      const photoResponse = await axios.get(photoUrl, {
        responseType: 'arraybuffer'
      });
      
      console.log(`Successfully downloaded image, size: ${photoResponse.data.byteLength} bytes`);
      
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('photo', Buffer.from(photoResponse.data), {
        filename: `photo_${Date.now()}.png`,
        contentType: 'image/png'
      });
      
      console.log('Uploading photo to VK server...');
      const uploadResponse = await axios.post(uploadUrl, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      
      console.log('Upload response received:', uploadResponse.data);
      
      if (!uploadResponse.data || uploadResponse.data.error || !uploadResponse.data.photo || uploadResponse.data.photo === 'null') {
        console.error('Invalid upload response:', uploadResponse.data);
        throw new Error('Failed to upload photo to VK server: invalid response');
      }
      
      // Step 3: Save the uploaded photo to wall
      console.log('Saving photo to wall...');
      const saveResponse = await axios.get('https://api.vk.com/method/photos.saveWallPhoto', {
        params: {
          group_id: Math.abs(parseInt(ownerId)).toString(),
          photo: uploadResponse.data.photo,
          server: uploadResponse.data.server,
          hash: uploadResponse.data.hash,
          access_token: token,
          v: vkApiVersion // Use the defined constant
        }
      });
      
      if (saveResponse.data.error) {
        throw new Error(`VK API error: ${saveResponse.data.error.error_msg}`);
      }
      
      // Step 4: Return attachment string
      const photo = saveResponse.data.response[0];
      const attachment = `photo${photo.owner_id}_${photo.id}`;
      
      console.log(`Successfully saved photo with ID: ${attachment}`);
      return { attachment, photoData: photo };
    } catch (error) {
      console.error('Error uploading photo to VK:', error.message);
      throw error;
    }
  }
}

module.exports = new VkPostingService();
