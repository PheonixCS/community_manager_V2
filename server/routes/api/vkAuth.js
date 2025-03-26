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

module.exports = router;
