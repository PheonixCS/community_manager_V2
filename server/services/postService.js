const Post = require('../models/Post');
const s3Service = require('./s3Service');

class PostService {
  async deletePost(postId) {
    try {
      const post = await Post.findById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Удаляем все связанные медиафайлы
      const mediaToDelete = [
        ...(post.mediaDownloads || []).map(media => media.s3Key),
        ...(post.downloadedVideos || []).map(video => video.s3Key)
      ].filter(Boolean); // Убираем пустые значения

      // Удаляем файлы из S3 параллельно
      if (mediaToDelete.length > 0) {
        await Promise.all(
          mediaToDelete.map(key => s3Service.deleteFile(key))
        );
      }

      // Удаляем сам пост
      await Post.findByIdAndDelete(postId);

      return {
        success: true,
        deletedMediaCount: mediaToDelete.length
      };
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  async deleteAllPosts() {
    try {
      // Получаем все посты с медиафайлами
      const posts = await Post.find({
        $or: [
          { mediaDownloads: { $exists: true, $ne: [] } },
          { downloadedVideos: { $exists: true, $ne: [] } }
        ]
      });

      // Собираем все S3 ключи для удаления
      const mediaToDelete = posts.reduce((acc, post) => {
        const mediaKeys = [
          ...(post.mediaDownloads || []).map(media => media.s3Key),
          ...(post.downloadedVideos || []).map(video => video.s3Key)
        ].filter(Boolean);
        return [...acc, ...mediaKeys];
      }, []);

      // Удаляем файлы из S3 параллельно
      if (mediaToDelete.length > 0) {
        await Promise.all(
          mediaToDelete.map(key => s3Service.deleteFile(key))
        );
      }

      // Удаляем все посты
      const result = await Post.deleteMany({});

      // Обновляем статистику всех задач скрапинга
      const ScrapingTask = require('../models/ScrapingTask');
      const statsResult = await ScrapingTask.updateMany({}, {
        'statistics.totalPosts': 0,
        'statistics.newPostsLastRun': 0,
        'statistics.updatedPostsLastRun': 0
      });

      return {
        success: true,
        deletedPosts: result.deletedCount,
        deletedMediaCount: mediaToDelete.length,
        resetStatsCount: statsResult.modifiedCount
      };
    } catch (error) {
      console.error('Error deleting all posts:', error);
      throw error;
    }
  }
}

module.exports = new PostService();
