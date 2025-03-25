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

module.exports = router;
