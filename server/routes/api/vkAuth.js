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
    // Use a direct database query for more reliability
    const VkUserToken = require('../../models/VkUserToken');
    const now = Math.floor(Date.now() / 1000);
    
    // Find active non-expired tokens
    const activeTokens = await VkUserToken.find({
      isActive: true,
      expiresAt: { $gt: now }
    });
    
    res.json({
      authenticated: activeTokens.length > 0,
      activeTokensCount: activeTokens.length,
      totalTokensCount: await VkUserToken.countDocuments()
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ 
      error: error.message,
      authenticated: false,
      activeTokensCount: 0,
      totalTokensCount: 0
    });
  }
});

/**
 * Получение групп пользователя из ВКонтакте
 * GET /api/vk-auth/groups
 */
router.get('/groups', async (req, res) => {
  try {
    const vkAuthService = require('../../services/vkAuthService');
    const Settings = require('../../models/Settings');
    
    // First try to get from settings for faster response
    let settings;
    try {
      settings = await Settings.findOne({});
      
      // If we have stored groups in settings, return them immediately
      if (settings?.vkGroups && Array.isArray(settings.vkGroups) && settings.vkGroups.length > 0) {
        console.log('Returning groups from settings cache:', settings.vkGroups.length);
        
        // Return both the formatted array and as a VK API-like response
        return res.json({
          response: {
            count: settings.vkGroups.length,
            items: settings.vkGroups.map(group => ({
              id: parseInt(group.id.replace('-', '')),
              name: group.name
            }))
          },
          cached: true
        });
      }
    } catch (settingsError) {
      console.error('Error getting groups from settings:', settingsError);
      // Continue with API request
    }
    
    // Try to get from VK API
    const token = await vkAuthService.getActiveToken(['groups']);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Не найден активный токен ВКонтакте с правами на доступ к группам',
        response: { count: 0, items: [] }
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
      },
      timeout: 5000 // Add timeout to prevent hanging requests
    });
    
    if (response.data.error) {
      throw new Error(`VK API Error: ${response.data.error.error_msg}`);
    }
    
    const groups = response.data.response.items || [];
    
    // Save groups to settings for future use
    try {
      if (!settings) {
        settings = await Settings.findOne({}) || new Settings({});
      }
      
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
    
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching VK groups:', error);
    
    // Try to return groups from settings as fallback
    try {
      const Settings = require('../../models/Settings');
      const settings = await Settings.findOne({});
      
      if (settings?.vkGroups && Array.isArray(settings.vkGroups) && settings.vkGroups.length > 0) {
        console.log('Returning groups from settings as fallback:', settings.vkGroups.length);
        
        return res.json({
          response: {
            count: settings.vkGroups.length,
            items: settings.vkGroups.map(group => ({
              id: parseInt(group.id.replace('-', '')),
              name: group.name
            }))
          },
          fallback: true
        });
      }
    } catch (fallbackError) {
      console.error('Error getting groups from settings fallback:', fallbackError);
    }
    
    // If all else fails, return an empty response instead of an error
    res.json({
      response: { count: 0, items: [] },
      error: error.message
    });
  }
});

module.exports = router;
