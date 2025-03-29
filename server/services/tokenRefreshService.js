const cron = require('node-cron');
const VkUserToken = require('../models/VkUserToken');
const vkAuthService = require('./vkAuthService');

/**
 * Сервис для автоматического обновления истекших токенов
 */
class TokenRefreshService {
  constructor() {
    this.initialized = false;
    this.scheduledJob = null;
  }
  
  /**
   * Инициализация сервиса
   */
  init() {
    if (this.initialized) {
      return;
    }
    
    // Запускаем проверку токенов каждые 25 минут
    this.scheduledJob = cron.schedule('* * * * *', async () => {
      await this.checkAndRefreshTokens();
    });
    const checkAfteInit = async () => {
      await this.checkAndRefreshTokens();
    };
    checkAfteInit();
    
    this.initialized = true;
    console.log('Token refresh service initialized');
  }
  
  /**
   * Остановка сервиса
   */
  stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
    }
    
    this.initialized = false;
    console.log('Token refresh service stopped');
  }
  
  /**
   * Проверка и обновление истекающих токенов
   */
  async checkAndRefreshTokens() {
    try {
      console.log('Checking for tokens to refresh...');
      
      // Получаем все активные токены
      const tokens = await VkUserToken.find({ isActive: true });
      
      let refreshedCount = 0;
      let failedCount = 0;
      
      for (const token of tokens) {
        // Если токен истекает в ближайшие 30 минут и есть refresh_token - обновляем его
        const expiresInSeconds = token.expiresAt - Math.floor(Date.now() / 1000);
        
        if (expiresInSeconds < 1800 && token.refreshToken) {
          try {
            console.log(`Token for user ${token.vkUserId} expires in ${expiresInSeconds} seconds, refreshing...`);
            await vkAuthService.refreshToken(token.deviceId, token.refreshToken, token.vkUserId);
            refreshedCount++;
          } catch (error) {
            console.error(`Failed to refresh token for user ${token.vkUserId}:`, error);
            failedCount++;
          }
        }
      }
      
      console.log(`Token refresh completed: ${refreshedCount} refreshed, ${failedCount} failed`);
    } catch (error) {
      console.error('Error in token refresh service:', error);
    }
  }
  
  /**
   * Немедленная проверка и обновление токенов
   * @returns {Promise<Object>} Результат операции
   */
  async refreshTokensNow() {
    try {
      await this.checkAndRefreshTokens();
      return { status: 'success', message: 'Tokens refresh process completed' };
    } catch (error) {
      console.error('Error in immediate token refresh:', error);
      return { status: 'error', error: error.message };
    }
  }
}

module.exports = new TokenRefreshService();
