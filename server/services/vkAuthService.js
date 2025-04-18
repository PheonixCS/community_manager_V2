const axios = require('axios');
const VkUserToken = require('../models/VkUserToken');
const Settings = require('../models/Settings');
const config = require('../config/config');
const VkToken = require('../models/VkUserToken');

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
    const vkAppId = config.vk.appId || this.getAppIdFromSettings();
    
    if (!vkAppId) {
      throw new Error('VK App ID not configured');
    }
    
    // Generate secure state for CSRF protection - must be at least 32 chars
    const state = this.generateRandomString(32);
    
    // Generate code verifier for PKCE - use only URL safe characters
    const codeVerifier = this.generateUrlSafeString(64);
    
    // Per VK documentation, we should use S256 method, but plain also works
    // Use plain for simplicity and compatibility
    const codeChallenge = codeVerifier; // Using plain method instead of S256
    
    // Store the code verifier to use later when exchanging the code
    this.storeAuthParams(state, {
      codeVerifier,
      redirectUri
    });
    
    // Define required scopes for VK ID
    const scopeValue = "wall,photos,groups,video,offline,docs,manage";
    
    console.log(`Creating VK auth URL with scope: ${scopeValue}`);
    console.log('Using redirect URI for authorization:', redirectUri);
    console.log('Using code challenge:', codeChallenge);
    
    // Use the VK ID authorization endpoint with PKCE parameters
    // Using plain method for code challenge - VK docs say S256 is preferred but plain also works
    return `https://id.vk.com/authorize?` +
      `client_id=${vkAppId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&display=page` +
      `&scope=${scopeValue}` +
      `&response_type=code` +
      `&state=${state}` + 
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=plain` +
      `&v=5.131`;
  }
  
  /**
   * Generate random string for security purposes
   * @param {number} length - Length of string to generate
   * @returns {string} Random string
   */
  generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
  
  /**
   * Generate URL-safe string for PKCE
   * Using only characters that are guaranteed to be URL-safe
   * @param {number} length - Length of string to generate
   * @returns {string} URL-safe random string
   */
  generateUrlSafeString(length) {
    // Use only URL-safe characters: A-Z, a-z, 0-9, '-', '.', '_', '~'
    // VK seems sensitive to the characters used in the code challenge
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
  
  /**
   * Generate code challenge for PKCE
   * @param {string} codeVerifier - Code verifier string
   * @returns {string} Code challenge
   */
  generateCodeChallenge(codeVerifier) {
    // For simplicity, we're using the "plain" method, where challenge = verifier
    // In production, should use "S256" method with SHA-256 hashing
    return codeVerifier;
  }
  
  /**
   * Store authorization parameters for code exchange
   * @param {string} state - State parameter for CSRF protection
   * @param {Object} params - Authorization parameters
   */
  storeAuthParams(state, params) {
    // Using a simple in-memory storage for demo purposes
    // You should use Redis or similar for a real application
    if (!this.authParamsStore) {
      this.authParamsStore = new Map();
    }
    
    console.log(`Storing auth params for state ${state}: `, params);
    
    this.authParamsStore.set(state, {
      ...params,
      createdAt: Date.now()
    });
    
    // Clean up old entries every hour
    setTimeout(() => {
      if (this.authParamsStore.has(state)) {
        this.authParamsStore.delete(state);
      }
    }, 3600 * 1000);
  }
  
  /**
   * Get stored authorization parameters
   * @param {string} state - State parameter from callback
   * @returns {Object|null} Stored parameters or null if not found
   */
  getAuthParams(state) {
    if (!this.authParamsStore) {
      return null;
    }
    
    const params = this.authParamsStore.get(state);
    if (params) {
      console.log(`Retrieved auth params for state ${state}: `, params);
      // Remove from store after use
      this.authParamsStore.delete(state);
    } else {
      console.log(`No auth params found for state ${state}`);
    }
    
    return params;
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
   * @param {string} state - State parameter from callback for validation
   * @param {string} redirectUri - URI для перенаправления (должен совпадать с URI при получении кода)
   * @returns {Promise<Object>} Информация о полученном токене
   */
  async getTokenByCode(code, state, redirectUri) {
    try {
      // Retrieve the code verifier using the state parameter
      const storedParams = this.getAuthParams(state);
      if (!storedParams || !storedParams.codeVerifier) {
        throw new Error('Invalid or expired state parameter. Please try authorizing again.');
      }
      
      // Use the stored redirect URI if available, fallback to the one provided
      const finalRedirectUri = storedParams.redirectUri || redirectUri;
      
      const appId = config.vk.appId || await this.getAppIdFromSettings();
      const appSecret = config.vk.appSecret || await this.getAppSecretFromSettings();
      
      if (!appId || !appSecret) {
        throw new Error('VK App ID or Secret not configured');
      }

      // Get device_id if it was provided (note: removed incorrect req reference)
      const device_id = 'web_default_device';

      // Log the redirect URI to verify it matches
      console.log('Using redirect URI for token exchange:', finalRedirectUri);
      console.log('Using code verifier from stored params:', storedParams.codeVerifier);
      console.log('Using device_id:', device_id);
      
      // Use POST request with form-data as per VK ID documentation
      const formData = new URLSearchParams();
      formData.append('client_id', appId);
      formData.append('client_secret', appSecret);
      formData.append('redirect_uri', finalRedirectUri);
      formData.append('code', code);
      formData.append('code_verifier', storedParams.codeVerifier);
      formData.append('device_id', device_id); // Include device_id as specified in VK docs
      formData.append('grant_type', 'authorization_code');
      
      // Make POST request to VK ID token endpoint
      const response = await axios.post('https://oauth.vk.com/access_token', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error_description || response.data.error}`);
      }
      
      console.log("Raw token response:", JSON.stringify(response.data));
      
      // Получаем информацию о пользователе
      const userInfo = await this.getUserInfo(response.data.access_token);
      
      // Extract scope from response, with fallback to requested scopes
      let tokenScopes = [];
      if (response.data.scope) {
        // If scope is a string, split by comma
        if (typeof response.data.scope === 'string') {
          tokenScopes = response.data.scope.split(',');
        } 
        // If scope is a number (bitmask), decode it
        else if (typeof response.data.scope === 'number') {
          tokenScopes = this.decodeBitMaskScopes(response.data.scope);
        }
      } else {
        // Fallback to requested scopes if no scope in response
        tokenScopes = ["wall", "photos", "groups", "video", "offline", "docs", "manage"];
      }
      
      // Always make sure manage is included as it's critical
      if (!tokenScopes.includes('manage')) {
        tokenScopes.push('manage');
      }
      
      // Создаем или обновляем запись с токеном
      const tokenData = {
        vkUserId: response.data.user_id.toString(),
        vkUserName: `${userInfo.first_name} ${userInfo.last_name}`,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || null,
        expiresAt: response.data.expires_in ? Math.floor(Date.now() / 1000) + response.data.expires_in : null,
        scope: tokenScopes,
        isActive: true,
        lastUsed: new Date(),
        userInfo: userInfo
      };
      
      // Save the device_id for potential refresh token usage
      if (device_id) {
        tokenData.deviceId = device_id;
      }
      
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
      // Log response data if available for better debugging
      if (error.response?.data) {
        console.error('Error response data:', error.response.data);
      }
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
   * @param {string} deviceId - Идентификатор устройства
   * @param {string} refreshToken - Токен для обновления
   * @returns {Promise<Object>} Обновленный токен
  */
  async refreshToken(deviceId, refreshToken, vkUserId) {
    try {
      console.log(`Attempting to refresh token with device ID: ${deviceId}`);
    
      // Получаем ID приложения из конфигурации
      const appId = config.vk.appId || await this.getAppIdFromSettings();
      
      if (!appId) {
        throw new Error('VK App ID not configured');
      }
      
      // Генерируем случайный state для безопасности
      const state = this.generateRandomString(32);
      
      // Формируем запрос точно в том формате, который указан
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('refresh_token', refreshToken);
      formData.append('client_id', appId);
      formData.append('device_id', deviceId);
      formData.append('state', state);
      console.log(formData);
      // Делаем POST запрос на указанный endpoint
      const response = await axios.post('https://id.vk.com/oauth2/auth', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log('Token refresh response:', response.data);
      const token = await VkUserToken.findOne({ vkUserId });
      if (!token) {
        throw new Error(`Token for user ${vkUserId} not found`);
      }
      token.isActive = true;
      token.accessToken = response.data.access_token;
      token.expiresAt = response.data.expires_in ? Math.floor(Date.now() / 1000) + response.data.expires_in : null;
      token.refreshToken = response.data.refresh_token || null;
      await token.save();
      return response.data;

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
   * Получение активного токена без фильтрации по разрешениям
   * @param {string|string[]} requiredScope - Параметр сохранен для совместимости, но не используется
   * @returns {Promise<Object|null>} Первый активный токен или null, если нет активных токенов
  */
  async getActiveToken(requiredScope = []) {
    try {
      // Логирование для отладки (можно опустить в production)
      console.log(`Requesting active token (scope parameter ignored): ${Array.isArray(requiredScope) ? requiredScope.join(',') : requiredScope}`);
      
      // Находим все активные неистекшие токены
      const activeTokens = await VkUserToken.find({ 
        isActive: true,
        expiresAt: { $gt: Math.floor(Date.now() / 1000) }
      });
      
      console.log(`Found ${activeTokens.length} active non-expired tokens`);
      
      // Если активные токены есть, возвращаем первый
      if (activeTokens.length > 0) {
        const token = activeTokens[0];
        
        // Для информации логируем права токена (но не используем для фильтрации)
        if (token.scope) {
          const scopeStr = Array.isArray(token.scope) ? token.scope.join(', ') : token.scope;
          console.log(`Selected token has scopes: ${scopeStr} (not filtered)`);
        }
        
        // Обновляем дату использования
        token.lastUsed = new Date();
        await token.save();
        
        return token;
      }
      
      // Если активных токенов нет, возвращаем null
      console.log('No active tokens found');
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
        await this.refreshToken(token.deviceId, token.refreshToken, token.vkUserId);
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
  
  /**
   * Decode bitwise scope mask to scope array
   * @param {number} bitmask - Scope bitmask
   * @returns {Array<string>} Array of scope names
   */
  decodeBitMaskScopes(bitmask) {
    // Map of VK permission bits
    const scopeMap = {
      1: 'notify',
      2: 'friends',
      4: 'photos',
      8: 'audio',
      16: 'video',
      32: 'stories',
      64: 'pages',
      128: 'status',
      256: 'notes',
      512: 'messages',
      1024: 'wall',
      2048: 'ads',
      4096: 'offline',
      8192: 'docs',
      16384: 'groups',
      32768: 'notifications',
      65536: 'stats',
      131072: 'email',
      262144: 'market',
      524288: 'phone'
    };
    
    const scopes = [];
    
    // Check each bit position
    for (const bit in scopeMap) {
      if ((bitmask & bit) !== 0) {
        scopes.push(scopeMap[bit]);
      }
    }
    
    return scopes;
  }

  /**
   * Exchange authorization code for token using PKCE
   * @param {string} code - Authorization code from VK
   * @param {string} redirectUri - Redirect URI used for authorization
   * @param {string} codeVerifier - PKCE code verifier from frontend
   * @param {string} deviceId - Device ID for token refresh
   * @returns {Promise<Object>} Token information and user data
   */
  async exchangeTokenWithVerifier(code, redirectUri, codeVerifier, deviceId = 'web_default_device') {
    try {
      const appId = config.vk.appId || await this.getAppIdFromSettings();
      const appSecret = config.vk.appSecret || await this.getAppSecretFromSettings();
      
      if (!appId || !appSecret) {
        throw new Error('VK App ID or Secret not configured');
      }
      
      console.log('Exchanging code for token with the following parameters:');
      console.log('- Redirect URI:', redirectUri);
      console.log('- Code verifier length:', codeVerifier?.length);
      console.log('- Device ID:', deviceId);
      
      // Prepare form data for the token request
      const formData = new URLSearchParams();
      formData.append('client_id', appId);
      formData.append('client_secret', appSecret);
      formData.append('redirect_uri', redirectUri);
      formData.append('code', code);
      formData.append('code_verifier', codeVerifier);
      formData.append('device_id', deviceId);
      formData.append('grant_type', 'authorization_code');
      
      // Make token request to VK ID
      const response = await axios.post('https://id.vk.com/oauth2/auth', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error_description || response.data.error}`);
      }
      
      console.log("Raw token response:", JSON.stringify(response.data));
      
      // Get user info
      const userInfo = await this.getUserInfo(response.data.access_token);
      
      // Extract scope from response with fallback
      let tokenScopes = [];
      if (response.data.scope) {
        // Handle different scope formats
        if (typeof response.data.scope === 'string') {
          tokenScopes = response.data.scope.split(',');
        } 
        else if (typeof response.data.scope === 'number') {
          tokenScopes = this.decodeBitMaskScopes(response.data.scope);
        }
      } else {
        // Fallback scopes
        tokenScopes = ["wall", "photos", "groups", "video", "offline", "docs", "manage"];
      }
      
      // Always ensure we have the manage permission
      if (!tokenScopes.includes('manage')) {
        tokenScopes.push('manage');
      }
      
      // Create token data
      const tokenData = {
        vkUserId: response.data.user_id.toString(),
        vkUserName: `${userInfo.first_name} ${userInfo.last_name}`,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || null,
        expiresAt: response.data.expires_in ? Math.floor(Date.now() / 1000) + response.data.expires_in : null,
        scope: tokenScopes,
        isActive: true,
        lastUsed: new Date(),
        userInfo: userInfo,
        deviceId: deviceId // Store device ID for refresh operations
      };
      
      // Update or create token in the database
      let token = await VkUserToken.findOne({ vkUserId: tokenData.vkUserId });
      
      if (token) {
        Object.assign(token, tokenData);
        await token.save();
      } else {
        token = await VkUserToken.create(tokenData);
      }
      
      return {
        token,
        user: userInfo
      };
    } catch (error) {
      console.error('Error exchanging token with verifier:', error);
      // Log response data if available
      if (error.response?.data) {
        console.error('Error response data:', error.response.data);
      }
      throw error;
    }
  }
}

module.exports = new VkAuthService();
