const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const s3Service = require('./s3Service');

class MediaDownloadService {
  constructor() {
    // Используем абсолютный путь и создаем директорию, если её нет
    this.downloadDir = path.resolve(__dirname, '../downloads');
    fs.ensureDirSync(this.downloadDir);
    console.log('Media Download Service initialized; Download directory:', this.downloadDir);
  }
  
  // Скачивание фото с VK
  async downloadPhoto(photo, communityId, postId) {
    try {
      if (!photo || !photo.sizes || photo.sizes.length === 0) {
        return { success: false, error: 'Invalid photo object' };
      }
      
      const sizes = [...photo.sizes].sort((a, b) => (b.width * b.height) - (a.width * a.height));
      const largestPhoto = sizes[-1];
      const photoUrl = largestPhoto.url;
      
      if (!photoUrl) {
        return { success: false, error: 'No photo URL found' };
      }
      
      // Скачиваем фото напрямую в буфер
      const response = await axios({
        method: 'GET',
        url: photoUrl,
        responseType: 'arraybuffer'
      });

      // Загружаем буфер напрямую в S3
      const fileName = `photo_${communityId}_${postId}_${photo.id || uuidv4()}.jpg`;
      const s3Result = await s3Service.uploadFromBuffer(
        response.data,
        fileName,
        `photos/${communityId}`,
        'image/jpeg'
      );
      
      if (!s3Result.success) {
        throw new Error(s3Result.error || 'Failed to upload to S3');
      }

      return {
        success: true,
        s3: s3Result,
        type: 'photo',
        id: photo.id
      };
    } catch (error) {
      console.error('Error downloading photo:', error);
      return { success: false, error: error.message };
    }
  }

  // Скачивание видео с VK
  async downloadVideo(video, communityId, postId) {
    try {
      if (!video) {
        return { success: false, error: 'Invalid video object' };
      }
      
      // Формируем URL видео
      const videoUrl = `https://vk.com/video${video.owner_id}_${video.id}`;
      // Формируем имя файла без лишних уровней вложенности
      const fileName = `video_${communityId}_${postId}_${video.id}.mp4`;
      
      // Создаем временную директорию, если её нет
      const tempDir = path.join(this.downloadDir, 'temp');
      await fs.ensureDir(tempDir);
      const tempFilePath = path.join(tempDir, fileName);
      
      // Скачиваем видео с помощью yt-dlp
      const result = await this.downloadVideoUsingYtDlp(videoUrl, tempFilePath);
      
      if (!result.success) {
        return result;
      }
      
      // Загружаем видео в S3 с унифицированным путём
      const s3Result = await s3Service.uploadFromBuffer(
        await fs.readFile(tempFilePath),
        fileName,
        `videos/${communityId}`,
        'video/mp4'
      );
      
      // Удаляем временный файл
      await fs.unlink(tempFilePath);
      
      return {
        success: true,
        s3: s3Result,
        type: 'video',
        id: video.id
      };
    } catch (error) {
      console.error('Error downloading video:', error);
      return { success: false, error: error.message };
    }
  }

  // Скачивание документа с VK
  async downloadDocument(doc, communityId, postId) {
    try {
      if (!doc || !doc.url) {
        return { success: false, error: 'Invalid document object' };
      }
      
      // Скачиваем документ напрямую в буфер
      const response = await axios({
        method: 'GET',
        url: doc.url,
        responseType: 'arraybuffer'
      });

      // Загружаем буфер напрямую в S3
      const fileName = `doc_${communityId}_${postId}_${doc.id}${path.extname(doc.title) || '.pdf'}`;
      const s3Result = await s3Service.uploadFromBuffer(
        response.data,
        fileName,
        `documents/${communityId}`,
        doc.type || 'application/octet-stream'
      );
      
      return {
        success: true,
        s3: s3Result,
        type: 'document',
        id: doc.id
      };
    } catch (error) {
      console.error('Error downloading document:', error);
      return { success: false, error: error.message };
    }
  }

  // Скачивание аудио с VK
  async downloadAudio(audio, communityId, postId) {
    try {
      if (!audio || !audio.url) {
        return { success: false, error: 'Invalid audio object or URL not found' };
      }
      
      // Получаем URL аудио
      const audioUrl = audio.url;
      
      // Генерируем имя файла
      const fileName = `audio_${communityId}_${postId}_${audio.id}.mp3`;
      const filePath = path.join(this.downloadDir, fileName);
      
      // Скачиваем аудио
      const response = await axios({
        method: 'GET',
        url: audioUrl,
        responseType: 'arraybuffer'
      });
      
      // Сохраняем аудио локально
      await fs.writeFile(filePath, response.data);
      
      // Загружаем аудио в S3
      const s3Result = await s3Service.uploadFileFromPath(filePath, `audios/${communityId}`);
      
      // Удаляем локальный файл после загрузки в S3
      await fs.unlink(filePath);
      
      return {
        success: true,
        localPath: filePath,
        s3: s3Result,
        type: 'audio',
        id: audio.id
      };
    } catch (error) {
      console.error('Error downloading audio:', error);
      return { success: false, error: error.message };
    }
  }

  // Скачивание видео с помощью yt-dlp
  async downloadVideoUsingYtDlp(videoUrl, outputPath) {
    return new Promise((resolve, reject) => {
      const ytdlpPath = config.ytdlp.path;
      
      // Создаем процесс yt-dlp для скачивания видео
      const ytdlpProcess = spawn(ytdlpPath, [
        videoUrl,
        '-o', outputPath,
        '--no-playlist',
        '--format', 'best[ext=mp4]'
      ]);

      let stdoutData = '';
      let stderrData = '';

      ytdlpProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        console.log(`yt-dlp stdout: ${data}`);
      });

      ytdlpProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error(`yt-dlp stderr: ${data}`);
      });

      ytdlpProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`Video downloaded successfully: ${outputPath}`);
          resolve({
            success: true,
            path: outputPath
          });
        } else {
          console.error(`yt-dlp process exited with code ${code}`);
          reject({
            success: false,
            error: `Failed to download video: ${stderrData || 'Unknown error'}`
          });
        }
      });

      ytdlpProcess.on('error', (err) => {
        console.error('Failed to start yt-dlp process:', err);
        reject({
          success: false,
          error: err.message
        });
      });
    });
  }

  // Обработка медиа-вложений в посте
  async processPostMedia(post, settings) {
    if (!settings.downloadMedia.enabled) {
      return { status: 'skipped', message: 'Media download is disabled' };
    }
    
    if (!post.attachments || post.attachments.length === 0) {
      return { status: 'no_media', message: 'No media attachments found' };
    }
    
    const results = [];
    const mediaDownloads = [];
    
    // Обрабатываем все вложения в посте
    for (const attachment of post.attachments) {
      // Проверяем, разрешено ли скачивать этот тип медиа
      if (!settings.downloadMedia.types[`${attachment.type}s`]) {
        continue;
      }

      let downloadResult = null;
      
      try {
        switch (attachment.type) {
          case 'photo':
            downloadResult = await this.downloadPhoto(attachment.photo, post.communityId, post.postId);
            break;
          case 'video':
            downloadResult = await this.downloadVideo(attachment.video, post.communityId, post.postId);
            break;
          case 'doc':
            downloadResult = await this.downloadDocument(attachment.doc, post.communityId, post.postId);
            break;
          case 'audio':
            downloadResult = await this.downloadAudio(attachment.audio, post.communityId, post.postId);
            break;
          default:
            downloadResult = { success: false, error: `Unsupported attachment type: ${attachment.type}` };
            break;
        }

        results.push({
          type: attachment.type,
          id: attachment[attachment.type]?.id,
          ...downloadResult
        });
        
        if (downloadResult && downloadResult.success) {
          mediaDownloads.push({
            type: attachment.type,
            mediaId: attachment[attachment.type]?.id?.toString(),
            s3Url: downloadResult.s3?.url,
            s3Key: downloadResult.s3?.key,
            downloadedAt: new Date()
          });
        }
      } catch (error) {
        console.error(`Error processing ${attachment.type}:`, error);
        results.push({
          type: attachment.type,
          id: attachment[attachment.type]?.id,
          success: false,
          error: error.message
        });
      }
    }
    
    // Добавляем информацию о скачанных медиа в пост
    if (mediaDownloads.length > 0) {
      try {
        // Проверяем, является ли post объектом Mongoose или простым объектом
        if (post._id && !post.save) {
          // Это простой объект с _id, получаем настоящую модель из базы
          const Post = require('../models/Post');
          const postModel = await Post.findById(post._id);
          if (postModel) {
            postModel.mediaDownloads = [...(postModel.mediaDownloads || []), ...mediaDownloads];
            await postModel.save();
          } else {
            console.error(`Post with ID ${post._id} not found in database`);
          }
        } else if (post.save && typeof post.save === 'function') {
          // Это модель Mongoose, можно напрямую сохранять
          post.mediaDownloads = [...(post.mediaDownloads || []), ...mediaDownloads];
          await post.save();
        } else {
          console.error('Post object is neither a Mongoose model nor has a valid _id');
        }
      } catch (saveError) {
        console.error('Error saving media downloads to post:', saveError);
        // Добавляем ошибку в результаты
        results.push({
          type: 'save_error',
          success: false,
          error: saveError.message
        });
      }
    }
    
    return {
      status: 'processed',
      results,
      downloadedCount: mediaDownloads.length
    };
  }
}

module.exports = new MediaDownloadService();
