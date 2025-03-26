const express = require('express');
const router = express.Router();
const vkAuthController = require('../../controllers/vkAuthController');

/**
 * Получение URL для авторизации в ВК
 * GET /api/vk-auth/auth-url
 */
router.get('/auth-url', vkAuthController.generateAuthUrl);

/**
 * Колбек для обработки авторизации ВК
 * GET /api/vk-auth/callback
 */
router.get('/callback', vkAuthController.handleCallback);

/**
 * Exchange authorization code for token
 * POST /api/vk-auth/exchange-token
 */
router.post('/exchange-token', vkAuthController.exchangeToken);

/**
 * Получение всех токенов пользователей
 * GET /api/vk-auth/tokens
 */
router.get('/tokens', vkAuthController.getAllTokens);

/**
 * Деактивация токена
 * PATCH /api/vk-auth/tokens/:id/deactivate
 */
router.patch('/tokens/:id/deactivate', vkAuthController.deactivateToken);

/**
 * Активация токена
 * PATCH /api/vk-auth/tokens/:id/activate
 */
router.patch('/tokens/:id/activate', vkAuthController.activateToken);

/**
 * Удаление токена
 * DELETE /api/vk-auth/tokens/:id
 */
router.delete('/tokens/:id', vkAuthController.deleteToken);

/**
 * Проверка статуса авторизации
 * GET /api/vk-auth/status
 */
router.get('/status', async (req, res) => {
  try {
    const tokens = await vkAuthController.getAllTokens(req, res);
    const hasActiveToken = tokens.some(token => 
      token.isActive && (token.expiresAt > Math.floor(Date.now() / 1000))
    );
    
    res.json({
      authenticated: hasActiveToken,
      activeTokensCount: tokens.filter(t => t.isActive && (t.expiresAt > Math.floor(Date.now() / 1000))).length,
      totalTokensCount: tokens.length
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Получение групп пользователя из ВКонтакте
 * GET /api/vk-auth/groups
 */
router.get('/groups', async (req, res) => {
  try {
    const vkAuthService = require('../../services/vkAuthService');
    const token = await vkAuthService.getActiveToken(['groups']);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Не найден активный токен ВКонтакте с правами на доступ к группам' 
      });
    }
    
    // Use VK API to get groups where user is admin
    const axios = require('axios');
    const response = await axios.get('https://api.vk.com/method/groups.get', {
      params: {
        access_token: token.accessToken,
        filter: 'admin',
        extended: 1,
        v: '5.131'
      }
    });
    
    if (response.data.error) {
      throw new Error(`VK API Error: ${response.data.error.error_msg}`);
    }
    
    const groups = response.data.response.items || [];
    
    // Save groups to settings for future use
    try {
      const Settings = require('../../models/Settings');
      let settings = await Settings.findOne({}) || new Settings({});
      
      // Format groups for storage
      const formattedGroups = groups.map(group => ({
        id: `-${group.id}`,
        name: group.name
      }));
      
      settings.vkGroups = formattedGroups;
      await settings.save();
    } catch (settingsError) {
      console.error('Error saving groups to settings:', settingsError);
      // Continue even if settings save fails
    }
    
    res.json(response.data.response); // Return the full response object
  } catch (error) {
    console.error('Error fetching VK groups:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
