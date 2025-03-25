const axios = require('axios');
const VkUserToken = require('../models/VkUserToken');
const Settings = require('../models/Settings');
const config = require('../config/config');

/**
 * Сервис для авторизации в ВК и управления токенами
 */
class VkAuthService {
  /**
   * Получение URL для OAuth авторизации в ВК
   * @param {string} redirectUri - URI для перенаправления после авторизации
   * @returns {string} URL для редиректа на страницу авторизации ВК
   */
  getAuthUrl(redirectUri) {
    const vkAppId = config.vkApi?.appId || this.getAppIdFromSettings();
    
    if (!vkAppId) {
      throw new Error('VK App ID not configured');
    }
    
    const scope = [
      'wall',       // Доступ к стене
      'groups',     // Доступ к сообществам
      'photos',     // Доступ к фотографиям
      'video',      // Доступ к видео
      'offline'     // Получение refresh token для бессрочного использования
    ].join(',');
    
    return `https://oauth.vk.com/authorize?client_id=${vkAppId}&display=page&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&v=5.131`;
  }
  
  /**
   * Получение App ID из настроек
   * @returns {string|null} App ID или null, если не настроен
   */
  async getAppIdFromSettings() {
    try {
      const settings = await Settings.findOne();
      return settings?.vkApi?.appId || null;
    } catch (error) {
      console.error('Error getting App ID from settings:', error);
      return null;
    }
  }
  
  /**
   * Получение токена по коду авторизации
   * @param {string} code - Код авторизации от ВК
   * @param {string} redirectUri - URI для перенаправления (должен совпадать с URI при получении кода)
   * @returns {Promise<Object>} Информация о полученном токене
   */
  async getTokenByCode(code, redirectUri) {
    try {
      const appId = config.vkApi?.appId || await this.getAppIdFromSettings();
      const appSecret = config.vkApi?.appSecret || await this.getAppSecretFromSettings();
      
      if (!appId || !appSecret) {
        throw new Error('VK App ID or Secret not configured');
      }
      
      const response = await axios.get('https://oauth.vk.com/access_token', {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code: code
        }
      });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error_description || response.data.error}`);
      }
      
      // Получаем информацию о пользователе
      const userInfo = await this.getUserInfo(response.data.access_token);
      
      // Создаем или обновляем запись с токеном
      const tokenData = {
        vkUserId: response.data.user_id.toString(),
        vkUserName: `${userInfo.first_name} ${userInfo.last_name}`,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + (response.data.expires_in || 86400), // По умолчанию 24 часа
        scope: response.data.scope ? response.data.scope.split(',') : [],
        isActive: true,
        lastUsed: new Date(),
        userInfo: userInfo
      };
      
      // Ищем существующий токен для этого пользователя
      let token = await VkUserToken.findOne({ vkUserId: tokenData.vkUserId });
      
      if (token) {
        // Обновляем существующий токен
        Object.assign(token, tokenData);
        await token.save();
      } else {
        // Создаем новый токен
        token = await VkUserToken.create(tokenData);
      }
      
      return {
        token,
        user: userInfo
      };
      
    } catch (error) {
      console.error('Error getting token by code:', error);
      throw error;
    }
  }
  
  /**
   * Получение App Secret из настроек
   * @returns {string|null} App Secret или null, если не настроен
   */
  async getAppSecretFromSettings() {
    try {
      const settings = await Settings.findOne();
      return settings?.vkApi?.appSecret || null;
    } catch (error) {
      console.error('Error getting App Secret from settings:', error);
      return null;
    }
  }
  
  /**
   * Получение информации о пользователе ВК
   * @param {string} accessToken - Токен доступа
   * @returns {Promise<Object>} Информация о пользователе
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get('https://api.vk.com/method/users.get', {
        params: {
          fields: 'photo_200,screen_name',
          access_token: accessToken,
          v: '5.131'
        }
      });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error.error_msg}`);
      }
      
      return response.data.response[0];
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  }
  
  /**
   * Обновление истекшего токена через refresh_token
   * @param {string} vkUserId - ID пользователя ВК
   * @returns {Promise<Object|null>} Обновленный токен или null в случае ошибки
   */
  async refreshToken(vkUserId) {
    try {
      // Получаем токен из базы
      const token = await VkUserToken.findOne({ vkUserId });
      
      if (!token || !token.refreshToken) {
        throw new Error(`No token or refresh token found for user ${vkUserId}`);
      }
      
      const appId = config.vkApi?.appId || await this.getAppIdFromSettings();
      const appSecret = config.vkApi?.appSecret || await this.getAppSecretFromSettings();
      
      if (!appId || !appSecret) {
        throw new Error('VK App ID or Secret not configured');
      }
      
      // Запрашиваем новый токен
      const response = await axios.get('https://oauth.vk.com/access_token', {
        params: {
          client_id: appId,
          client_secret: appSecret,
          refresh_token: token.refreshToken,
          grant_type: 'refresh_token'
        }
      });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error_description || response.data.error}`);
      }
      
      // Обновляем данные токена
      token.accessToken = response.data.access_token;
      
      if (response.data.refresh_token) {
        token.refreshToken = response.data.refresh_token;
      }
      
      token.expiresAt = Math.floor(Date.now() / 1000) + (response.data.expires_in || 86400);
      token.lastRefreshed = new Date();
      
      await token.save();
      
      return token;
    } catch (error) {
      console.error(`Error refreshing token for user ${vkUserId}:`, error);
      
      // В случае ошибки обновления помечаем токен как неактивный
      const token = await VkUserToken.findOne({ vkUserId });
      if (token) {
        token.isActive = false;
        await token.save();
      }
      
      return null;
    }
  }
  
  /**
   * Получение активного токена для нужных разрешений, с автоматическим обновлением
   * @param {string|string[]} requiredScope - Необходимые разрешения
   * @returns {Promise<Object|null>} Токен доступа или null, если нет подходящего токена
   */
  async getActiveToken(requiredScope) {
    try {
      // Находим подходящий токен
      let token = await VkUserToken.findActiveWithScope(requiredScope);
      
      // Если токен существует, но истек - пробуем его обновить
      if (token && token.isExpired() && token.refreshToken) {
        console.log(`Token for user ${token.vkUserId} expired, refreshing...`);
        token = await this.refreshToken(token.vkUserId);
      }
      
      // Если токен существует и действителен - обновляем дату последнего использования
      if (token && !token.isExpired()) {
        token.lastUsed = new Date();
        await token.save();
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting active token:', error);
      return null;
    }
  }
  
  /**
   * Получение всех токенов пользователей
   * @returns {Promise<Array>} Массив токенов
   */
  async getAllTokens() {
    return await VkUserToken.find().sort({ updatedAt: -1 });
  }
  
  /**
   * Деактивация токена
   * @param {string} tokenId - ID токена в базе данных
   * @returns {Promise<boolean>} Успешность операции
   */
  async deactivateToken(tokenId) {
    try {
      const token = await VkUserToken.findById(tokenId);
      
      if (!token) {
        throw new Error(`Token with ID ${tokenId} not found`);
      }
      
      token.isActive = false;
      await token.save();
      
      return true;
    } catch (error) {
      console.error(`Error deactivating token ${tokenId}:`, error);
      return false;
    }
  }
  
  /**
   * Активация токена
   * @param {string} tokenId - ID токена в базе данных
   * @returns {Promise<boolean>} Успешность операции
   */
  async activateToken(tokenId) {
    try {
      const token = await VkUserToken.findById(tokenId);
      
      if (!token) {
        throw new Error(`Token with ID ${tokenId} not found`);
      }
      
      // Если токен истек, но есть refresh token - обновляем перед активацией
      if (token.isExpired() && token.refreshToken) {
        await this.refreshToken(token.vkUserId);
      }
      
      token.isActive = true;
      await token.save();
      
      return true;
    } catch (error) {
      console.error(`Error activating token ${tokenId}:`, error);
      return false;
    }
  }
  
  /**
   * Удаление токена
   * @param {string} tokenId - ID токена в базе данных
   * @returns {Promise<boolean>} Успешность операции
   */
  async deleteToken(tokenId) {
    try {
      await VkUserToken.findByIdAndDelete(tokenId);
      return true;
    } catch (error) {
      console.error(`Error deleting token ${tokenId}:`, error);
      return false;
    }
  }
}

module.exports = new VkAuthService();
