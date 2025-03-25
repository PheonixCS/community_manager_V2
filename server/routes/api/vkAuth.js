const express = require('express');
const router = express.Router();
const vkAuthService = require('../../services/vkAuthService');

/**
 * Получение URL для авторизации в ВК
 * GET /api/vk-auth/auth-url
 */
router.get('/auth-url', (req, res) => {
  try {
    // В продакшене нужно получать хост из заголовков или конфига
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/api/vk-auth/callback`;
    
    const authUrl = vkAuthService.getAuthUrl(redirectUri);
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
    const { code } = req.query;
    
    if (!code) {
      throw new Error('Authorization code not provided');
    }
    
    // Получаем хост для redirectUri (должен совпадать с тем, что был при запросе авторизации)
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/api/vk-auth/callback`;
    
    // Получаем токен по коду
    const result = await vkAuthService.getTokenByCode(code, redirectUri);
    
    // В реальном приложении здесь должно быть перенаправление на фронтенд с сообщением об успехе
    res.json({
      status: 'success',
      message: 'Authorization successful',
      user: result.user
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
