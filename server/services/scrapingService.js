const vkApiService = require('./vkApiService');
// Fix the paths to the models
const Task = require('../models/ScrapingTask');
const FilterTemplate = require('../models/FilterTemplate');
const Post = require('../models/Post');

class ScrapingService {
  // Adding the executeTask method that was expected by other parts of the application
  async executeTask(taskId) {
    return this.processTask(taskId);
  }

  async processTask(taskId) {
    try {
      console.log(`Processing task ${taskId}`);
      
      // 1. Загрузка задачи
      const task = await Task.findById(taskId).populate({
        path: 'filterTemplates',
        select: 'mediaFilters' // Указываем, что нужно извлечь только поле mediaFilters
      }).populate('communities');
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // console.log(`Task loaded: ${task.name}, ${task.communities.length} communities, ${task.filterTemplates} filter templates`);
      
      const filtersSet = task.filterTemplates.length > 0 
      ? task.filterTemplates.map(template => template.mediaFilters) 
      : [];
      // console.log(`Filters set: ${filtersSet[0].photos.min}`); 
      
      
      
      let totalProcessedPosts = 0;
      let newPostsCount = 0;
      let updatedPostsCount = 0;
      
      // 3. Обработка каждого сообщества в задаче
      for (const community of task.communities) {
        // console.log(`Processing community: ${community.name} (${community.type}: ${community.value})`);
        
        try {
          // Резолвим ID сообщества если нужно
          const communityId = await vkApiService.resolveCommunityId(community);
          // console.log(`Resolved community ID: ${communityId}`);
          // console.log(task)
          // return
          // 4. Получение постов из VK API (с базовой фильтрацией по глубине)
          const posts = await vkApiService.getPosts(communityId, task.filters.count, task.filters.offset, {
            depth: task.filters.depth, // Используем значение глубины из task.filters
            filter: task.filters.filter || 'all', // Используем значение фильтра из task.filters
            extended: task.filters.extended // Используем значение extended из task.filters
          });
          
          // console.log(`Retrieved ${posts.length} posts after depth filtering`);
          
          // 5. Применение шаблонов фильтрации (пост сохраняется, если проходит хотя бы один шаблон)
          //
          const filteredPosts = vkApiService.applyfiltersSet(posts, filtersSet, task.filters.skipExternalLinks);

          
          // console.log(`After applying filter templates: ${filteredPosts.length} posts to save`);
          
          // 6. Сохранение отфильтрованных постов
          for (const post of filteredPosts) {
            // Сохраняем пост и получаем информацию о том, новый он или обновленный
            const result = await this.savePost(post, task, community);
            
            // Инкрементируем счетчики на основе результата
            if (result.isNew) {
              newPostsCount++;
              // console.log(`New post ${post.id} added`);
            } else {
              updatedPostsCount++;
              // console.log(`Existing post ${post.id} updated`);
            }
            
            totalProcessedPosts++;
          }
          
          // console.log(`Saved ${filteredPosts.length} posts from community ${community.name}`);
          
        } catch (error) {
          console.error(`Error processing community ${community.name}:`, error);
          // Продолжаем с другими сообществами
        }
      }
      
      // 7. Обновление статистики задачи
      const currentStats = task.statistics || {};
      const totalPosts = (currentStats.totalPosts || 0) + newPostsCount;
      
      await Task.findByIdAndUpdate(taskId, {
        'schedule.lastRun': new Date(),
        'shedule.nextRun': new Date(Date.now() + task.schedule.interval * 60 * 1000), // Устанавливаем следующее время запуска
        status: 'completed',
        'statistics.totalPosts': totalPosts,
        'statistics.newPostsLastRun': newPostsCount,
        'statistics.updatedPostsLastRun': updatedPostsCount,
        'statistics.lastRunAt': new Date(),
        
      });
      
      // console.log(`Task ${taskId} completed, processed ${totalProcessedPosts} posts (${newPostsCount} new, ${updatedPostsCount} updated)`);
      
    } catch (error) {
      console.error(`Error processing task ${taskId}:`, error);
      
      // Обновляем статус задачи на "failed"
      await Task.findByIdAndUpdate(taskId, {
        lastRun: new Date(),
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
  
  async savePost(post, task, community) {
    try {
      // console.log(`Сохраняем пост ${post.id} из сообщества ${community.name || community.value}`);
      
      // Проверяем, существует ли уже такой пост
      let existingPost = await Post.findOne({
        $or: [
          { vkId: post.id, communityId: post.from_id },
          { postId: post.id, communityId: post.from_id }
        ]
      });
      
      // Определяем, является ли пост каруселью
      const isCarousel = post.carousel_offset !== undefined && post.carousel_offset === 0;
      // console.log(`Пост ${post.id} ${isCarousel ? 'является' : 'не является'} каруселью`);
      
      if (existingPost) {
        // console.log(`Пост ${post.id} уже существует, обновляем...`);
        // Обновляем существующий пост
        existingPost.likes = post.likes?.count || 0;
        existingPost.reposts = post.reposts?.count || 0;
        existingPost.views = post.views?.count || 0;
        existingPost.lastUpdated = new Date();
        existingPost.isCarousel = isCarousel; // Добавляем флаг карусели
        
        // Рассчитываем рейтинг просмотров
        existingPost.viewRate = existingPost.calculateViewRate();
        // console.log(`Обновлен рейтинг просмотров для поста ${post.id}: ${existingPost.viewRate} просмотров/секунду`);
        
        // Обновляем вложения, если они изменились
        if (post.attachments && (!existingPost.attachments || existingPost.attachments.length !== post.attachments.length)) {
          existingPost.attachments = post.attachments;
          
          // Если нужно скачать медиа и есть вложения
          // if (task.downloadMedia) {
            
          // console.log(`Скачиваем медиа для существующего поста ${post.id}`);
          const mediaDownloadService = require('./mediaDownloadService');
          
          // Получаем настройки
          // const Settings = require('../models/Settings');
          // const settings = await Settings.findOne() || {};
          
          // Подготавливаем пост для mediaDownloadService
          const postForMediaDownload = {
            ...savedPost.toObject(),
            _id: savedPost._id, // Явно добавляем _id
            communityId: post.from_id,
            postId: post.id
          };
          
          await mediaDownloadService.processPostMedia(postForMediaDownload, {
            downloadMedia: {
              enabled: true,
              types: {
                photos: true,
                videos: true,
                documents: true,
                audios: true
              }
            }
          });
          
          // Обновляем пост после скачивания медиа
          existingPost = await Post.findById(existingPost._id);
          // }
        }
        
        await existingPost.save();
        // console.log(`Пост ${post.id} успешно обновлен`);
        return { 
          post: existingPost, 
          isNew: false // Этот пост был обновлен, а не создан
        };  
      }
      
      // Создаем новый пост
      // console.log(`Создаем новый пост ${post.id}`);
      // console.log(post);
      const newPost = new Post({
        vkId: post.id,
        postId: post.id,
        communityId: post.from_id,
        taskId: task._id,
        text: post.text || '',
        date: new Date(post.date * 1000),
        likes: post.likes?.count || 0,
        reposts: post.reposts?.count || 0,
        views: post.views?.count || 0,
        attachments: post.attachments || [],
        isCarousel: isCarousel, // Добавляем флаг карусели
        createdAt: new Date(),
        lastUpdated: new Date(),
        mediaDownloads: [],
        downloadedVideos: []
      });
      
      // Рассчитываем начальный рейтинг просмотров
      newPost.viewRate = newPost.calculateViewRate();
      // console.log(`Установлен начальный рейтинг просмотров для поста ${post.id}: ${newPost.viewRate} просмотров/секунду`);
      
      // Сохраняем пост в базу данных
      const savedPost = await newPost.save();
      // console.log(`Пост ${post.id} успешно сохранен с MongoDB ID: ${savedPost._id}`);
      
      // Скачиваем медиа, если включено в настройках и есть вложения
      if (post.attachments && post.attachments.length > 0) {
        // console.log(`Скачиваем медиа для нового поста ${post.id}`);
        const mediaDownloadService = require('./mediaDownloadService');
        // Подготавливаем пост для mediaDownloadService с явным указанием _id
        const postForMediaDownload = {
          ...savedPost.toObject(),
          _id: savedPost._id, // Явно добавляем _id
          communityId: post.from_id,
          postId: post.id
        };
        
        await mediaDownloadService.processPostMedia(postForMediaDownload, {
          downloadMedia: {
            enabled: true,
            types: {
              photos: true,
              videos: true,
              documents: true,
              audios: true
            }
          }
        });
        
        // Обновляем пост после скачивания медиа
        // return await Post.findById(savedPost._id);
      }
      return {
        post: savedPost,
        isNew: true // Этот пост был создан
      };
    } catch (error) {
      console.error(`Ошибка при сохранении поста ${post.id}:`, error);
      // Добавляем больше деталей для отладки
      console.error(`Данные поста:`, JSON.stringify({
        id: post.id,
        text: post.text ? post.text.substring(0, 100) : null,
        attachmentsCount: post.attachments ? post.attachments.length : 0
      }));
      console.error(`Данные сообщества:`, JSON.stringify({
        id: community._id,
        name: community.name,
        type: community.type,
        value: community.value
      }));
      throw error;
    }
  }
  
  // Добавим метод для скачивания медиа-контента
  async downloadMediaContent(post, postId) {
    try {
      if (!post.attachments || post.attachments.length === 0) {
        // console.log(`No attachments to download for post ${post.id}`);
        return;
      }
      
      // console.log(`Downloading ${post.attachments.length} attachments for post ${post.id}`);
      
      const fs = require('fs');
      const path = require('path');
      const axios = require('axios');
      
      // Создаем директорию для сохранения медиа
      const mediaDir = path.join(process.cwd(), 'public', 'media', postId.toString());
      
      // Проверяем существование директории
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true });
        // console.log(`Created directory: ${mediaDir}`);
      }
      
      // Обрабатываем каждое вложение
      for (const [index, attachment] of post.attachments.entries()) {
        try {
          let mediaUrl = null;
          let filename = null;
          
          // Определяем URL и имя файла в зависимости от типа вложения
          if (attachment.type === 'photo') {
            // Используем последний размер в массиве (обычно самый большой)
            const sizes = attachment.photo.sizes;
            if (sizes && sizes.length > 0) {
              const bestPhoto = sizes[sizes.length - 1]; // Берем последний размер
              
              mediaUrl = bestPhoto.url;
              // console.log(`Selected photo (${bestPhoto.width}x${bestPhoto.height}) for post ${post.id}, from index ${sizes.length - 1} of ${sizes.length}`);
              filename = `photo_${post.id}_${index}.jpg`;
            } else {
              // console.log(`No photo sizes found for post ${post.id}`);
              continue;
            }
          } 
          else if (attachment.type === 'video') {
            // Для видео также выбираем последнее превью из массива
            if (attachment.video.image && attachment.video.image.length > 0) {
              const bestImage = attachment.video.image[attachment.video.image.length - 1];
              
              mediaUrl = bestImage.url;
              // console.log(`Selected video preview (${bestImage.width}x${bestImage.height}) for post ${post.id}`);
              filename = `video_preview_${post.id}_${index}.jpg`;
            } else {
              // console.log(`No preview image for video in post ${post.id}`);
              continue;
            }
          }
          else if (attachment.type === 'doc') {
            mediaUrl = attachment.doc.url;
            filename = `doc_${post.id}_${index}_${attachment.doc.title}`;
          }
          else if (attachment.type === 'audio') {
            // В большинстве случаев аудио недоступно для прямого скачивания
            // console.log(`Skipping audio attachment in post ${post.id}`);
            continue;
          }
          else {
            // console.log(`Unsupported attachment type: ${attachment.type} in post ${post.id}`);
            continue;
          }
          
          if (mediaUrl) {
            // Скачиваем и сохраняем файл
            const filePath = path.join(mediaDir, filename);
            
            const response = await axios({
              method: 'GET',
              url: mediaUrl,
              responseType: 'stream'
            });
            
            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
              writer.on('finish', resolve);
              writer.on('error', reject);
            });
            
            // console.log(`Downloaded ${attachment.type} to ${filePath}`);
          }
        } catch (attachError) {
          console.error(`Error downloading attachment ${index} for post ${post.id}:`, attachError.message);
          // Продолжаем с другими вложениями
        }
      }
      
      // console.log(`Finished downloading media for post ${post.id}`);
    } catch (error) {
      console.error(`Error downloading media for post ${post.id}:`, error.message);
      // Не останавливаем работу из-за ошибки медиа
    }
  }
}

module.exports = new ScrapingService();
