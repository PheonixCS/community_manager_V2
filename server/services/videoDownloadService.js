const ytdl = require('ytdl-core');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const Post = require('../models/Post');
const Settings = require('../models/Settings');
const s3Service = require('./s3Service');
const config = require('../config/config');

class VideoDownloadService {
  constructor() {
    // Создаем директорию для скачанных видео
    this.downloadDir = path.join(__dirname, '../downloads');
    fs.ensureDirSync(this.downloadDir);
    console.log('Video download service initialized; Download directory:', this.downloadDir);
  }

  // Обновляем метод скачивания видео
  async downloadVideoFromVk(videoUrl, fileName, communityId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Получаем настройки
        const settings = await Settings.findOne() || await Settings.create({});
        
        const ytdlpPath = path.resolve(config.ytdlp.path);
        console.log('Using yt-dlp path:', ytdlpPath);

        // Создаём временную директорию, если её нет
        const tempDir = path.join(this.downloadDir, 'temp');
        await fs.ensureDir(tempDir);
        
        // Временный путь для файла
        const tempFilePath = path.join(tempDir, `${fileName}.mp4`);

        const ytdlpProcess = spawn(ytdlpPath, [
          videoUrl,
          '-o', tempFilePath,
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

        ytdlpProcess.on('close', async (code) => {
          if (code === 0) {
            try {
              console.log(`Video downloaded to temp: ${tempFilePath}`);
              
              // Загружаем файл в S3 с унифицированным путём
              const s3Result = await s3Service.uploadFromBuffer(
                await fs.readFile(tempFilePath),
                `${fileName}.mp4`,
                `videos/${communityId}`,
                'video/mp4'
              );

              // Удаляем временный файл
              await fs.unlink(tempFilePath);

              resolve({
                success: true,
                s3: s3Result
              });
            } catch (error) {
              console.error('Error processing downloaded video:', error);
              reject({
                success: false,
                error: error.message
              });
            }
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
      } catch (error) {
        reject({
          success: false,
          error: error.message
        });
      }
    });
  }

  // Скачивание видео с помощью yt-dlp
  async downloadVideoUsingYtDlp(videoUrl, outputPath) {
    return new Promise((resolve, reject) => {
      // Используем абсолютный путь к yt-dlp.exe
      const ytdlpPath = path.resolve(config.ytdlp.path);
      console.log('Using yt-dlp path:', ytdlpPath);
      
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
            path: outputPath,
            fileName: path.basename(outputPath)
          });
        } else {
          console.error(`yt-dlp process exited with code ${code}`);
          reject(new Error(`Failed to download video: ${stderrData || 'Unknown error'}`));
        }
      });

      ytdlpProcess.on('error', (err) => {
        console.error('Failed to start yt-dlp process:', err);
        reject(err);
      });
    });
  }

  // Функция для поиска и обработки видео-вложений в посте
  async processPostVideos(post) {
    try {
      const settings = await Settings.findOne() || await Settings.create({});

      if (!post.attachments || post.attachments.length === 0) {
        return { status: 'no_videos', message: 'No video attachments found' };
      }

      const videoAttachments = post.attachments.filter(
        attachment => attachment.type === 'video'
      );

      if (videoAttachments.length === 0) {
        return { status: 'no_videos', message: 'No video attachments found' };
      }

      const downloadResults = [];
      let updatedDownloadedVideos = [...(post.downloadedVideos || [])];

      for (const attachment of videoAttachments) {
        const video = attachment.video;
        const videoId = video.id.toString();

        // Проверяем, не скачано ли уже это видео
        const isAlreadyDownloaded = updatedDownloadedVideos.some(
          dv => dv.videoId === videoId
        );

        if (isAlreadyDownloaded) {
          downloadResults.push({
            videoId,
            status: 'already_downloaded',
            message: 'Video already downloaded'
          });
          continue;
        }

        try {
          const videoUrl = `https://vk.com/video${video.owner_id}_${video.id}`;
          const fileName = `${post.communityId}_${post.postId.split('_')[1]}_${video.id}`;
          
          // Используем обновлённый метод скачивания
          const downloadResult = await this.downloadVideoFromVk(videoUrl, fileName, post.communityId);
          
          if (downloadResult.success) {
            // Добавляем информацию о скачанном видео
            const newDownloadedVideo = {
              videoId: videoId,
              s3Url: downloadResult.s3.url,
              s3Key: downloadResult.s3.key,
              fileName: `${fileName}.mp4`,
              title: video.title || 'Untitled',
              downloadedAt: new Date()
            };
            
            // Добавляем в массив скачанных видео
            updatedDownloadedVideos.push(newDownloadedVideo);
            
            downloadResults.push({
              videoId,
              status: 'success',
              s3: downloadResult.s3
            });
          }
        } catch (error) {
          console.error(`Error downloading video ${video.id}:`, error);
          downloadResults.push({
            videoId,
            status: 'error',
            message: error.message
          });
        }
      }

      // Обновляем пост с информацией о скачанных видео
      post.downloadedVideos = updatedDownloadedVideos;
      await post.save();

      return {
        status: 'processed',
        results: downloadResults,
        downloadedCount: downloadResults.filter(r => r.status === 'success').length,
        downloadedVideos: updatedDownloadedVideos // Добавляем в ответ актуальный список скачанных видео
      };
    } catch (error) {
      console.error('Error processing post videos:', error);
      throw error;
    }
  }

  // Функция для скачивания видео из поста по его ID
  async downloadVideosFromPost(postId) {
    try {
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error(`Post with ID ${postId} not found`);
      }

      return await this.processPostVideos(post);
    } catch (error) {
      console.error(`Error downloading videos from post ${postId}:`, error);
      throw error;
    }
  }

  // Функция для скачивания всех видео из постов определенного сообщества
  async downloadAllVideosFromCommunity(communityId) {
    try {
      const posts = await Post.find({ communityId });
      
      const results = {
        total: posts.length,
        processedPosts: 0,
        downloadedVideos: 0,
        errors: 0
      };

      for (const post of posts) {
        try {
          const result = await this.processPostVideos(post);
          results.processedPosts++;
          
          if (result.status === 'processed') {
            results.downloadedVideos += result.downloadedCount;
          }
        } catch (error) {
          console.error(`Error processing post ${post._id}:`, error);
          results.errors++;
        }
      }

      return results;
    } catch (error) {
      console.error(`Error downloading videos from community ${communityId}:`, error);
      throw error;
    }
  }
}

module.exports = new VideoDownloadService();
