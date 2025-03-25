import axios from 'axios';

/**
 * Сервис для работы с авторизацией ВКонтакте
 */
const vkAuthService = {
  /**
   * Получение URL для авторизации ВКонтакте
   * @returns {Promise<string>} URL для авторизации
   */
  getAuthUrl: async () => {
    const response = await axios.get('/api/vk-auth/auth-url');
    return response.data.authUrl;
  },
  
  /**
   * Получение списка токенов
   * @returns {Promise<Array>} Список токенов
   */
  getTokens: async () => {
    const response = await axios.get('/api/vk-auth/tokens');
    return response.data;
  },
  
  /**
   * Деактивация токена
   * @param {string} tokenId - ID токена
   * @returns {Promise<Object>} Результат операции
   */
  deactivateToken: async (tokenId) => {
    const response = await axios.patch(`/api/vk-auth/tokens/${tokenId}/deactivate`);
    return response.data;
  },
  
  /**
   * Активация токена
   * @param {string} tokenId - ID токена
   * @returns {Promise<Object>} Результат операции
   */
  activateToken: async (tokenId) => {
    const response = await axios.patch(`/api/vk-auth/tokens/${tokenId}/activate`);
    return response.data;
  },
  
  /**
   * Удаление токена
   * @param {string} tokenId - ID токена
   * @returns {Promise<Object>} Результат операции
   */
  deleteToken: async (tokenId) => {
    const response = await axios.delete(`/api/vk-auth/tokens/${tokenId}`);
    return response.data;
  },
  
  /**
   * Проверка статуса авторизации (есть ли активные токены)
   * @returns {Promise<boolean>} true, если есть хотя бы один активный токен
   */
  checkAuthStatus: async () => {
    try {
      const tokens = await vkAuthService.getTokens();
      return tokens.some(token => 
        token.isActive && !vkAuthService.isTokenExpired(token.expiresAt)
      );
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  },
  
  /**
   * Проверка истечения токена
   * @param {number} expiresAt - Время истечения токена в UNIX timestamp
   * @returns {boolean} true, если токен истек
   */
  isTokenExpired: (expiresAt) => {
    return Math.floor(Date.now() / 1000) >= expiresAt;
  }
};

export default vkAuthService;
