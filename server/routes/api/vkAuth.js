const express = require('express');
const router = express.Router();
const vkAuthService = require('../../services/vkAuthService');
const config = require('../../config/config');

/**
 * Получение URL для авторизации в ВК
 * GET /api/vk-auth/auth-url
 */
router.get('/auth-url', (req, res) => {
  try {
    // Get the correct redirect URI from configuration or environment
    const redirectUri = config.vk.redirectUri || 'https://krazu-group.tech/api/vk-auth/callback';
    
    // Generate auth URL with the updated scope implementation
    const authUrl = vkAuthService.getAuthUrl(redirectUri);
    
    // Log the complete URL for debugging
    console.log('Generated complete VK auth URL:', authUrl);
    
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Колбек для обработки авторизации ВК
 * GET /api/vk-auth/callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Log the incoming request parameters
    console.log('VK auth callback received with params:', req.query);
    
    if (!code) {
      throw new Error('Authorization code not provided');
    }
    
    // Use the exact same redirect URI as in the auth URL request
    const redirectUri = config.vk.redirectUri || 'https://krazu-group.tech/api/vk-auth/callback';
    
    // Pass the state to token exchange to validate it and retrieve stored params
    const result = await vkAuthService.getTokenByCode(code, state, redirectUri);
    
    // Log the received token scope for debugging
    console.log('Received token with scope:', result.token.scope);
    
    // В реальном приложении здесь должно быть перенаправление на фронтенд с сообщением об успехе
    res.json({
      status: 'success',
      message: 'Authorization successful',
      user: result.user,
      scope: result.token.scope
    });
  } catch (error) {
    console.error('Error processing auth callback:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Получение всех токенов пользователей
 * GET /api/vk-auth/tokens
 */
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await vkAuthService.getAllTokens();
    
    // Не отправляем сами токены в API ответе
    const safeTokens = tokens.map(token => ({
      id: token._id,
      vkUserId: token.vkUserId,
      vkUserName: token.vkUserName,
      isActive: token.isActive,
      expiresAt: token.expiresAt,
      lastUsed: token.lastUsed,
      lastRefreshed: token.lastRefreshed,
      scope: token.scope,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      userInfo: {
        firstName: token.userInfo?.first_name,
        lastName: token.userInfo?.last_name,
        photo: token.userInfo?.photo_200,
        screenName: token.userInfo?.screen_name
      }
    }));
    
    res.json(safeTokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Деактивация токена
 * PATCH /api/vk-auth/tokens/:id/deactivate
 */
router.patch('/tokens/:id/deactivate', async (req, res) => {
  try {
    const success = await vkAuthService.deactivateToken(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Token not found or could not be deactivated' });
    }
    
    res.json({ 
      status: 'success',
      message: 'Token deactivated successfully' 
    });
  } catch (error) {
    console.error(`Error deactivating token ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Активация токена
 * PATCH /api/vk-auth/tokens/:id/activate
 */
router.patch('/tokens/:id/activate', async (req, res) => {
  try {
    const success = await vkAuthService.activateToken(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Token not found or could not be activated' });
    }
    
    res.json({ 
      status: 'success',
      message: 'Token activated successfully' 
    });
  } catch (error) {
    console.error(`Error activating token ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Удаление токена
 * DELETE /api/vk-auth/tokens/:id
 */
router.delete('/tokens/:id', async (req, res) => {
  try {
    const success = await vkAuthService.deleteToken(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Token not found or could not be deleted' });
    }
    
    res.json({ 
      status: 'success',
      message: 'Token deleted successfully' 
    });
  } catch (error) {
    console.error(`Error deleting token ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
