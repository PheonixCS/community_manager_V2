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
        // console.log('Returning groups from settings cache:', settings.vkGroups.length);
        
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
        name: group.name,
        screen_name: group.screen_name || null  // Добавляем доменное имя
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
        // console.log('Returning groups from settings as fallback:', settings.vkGroups.length);
        
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

/**
 * Обновление списка групп пользователя из ВКонтакте
 * GET /api/vk-auth/refresh-groups
 */
router.get('/refresh-groups', async (req, res) => {
  try {
    const vkAuthService = require('../../services/vkAuthService');
    const Settings = require('../../models/Settings');
    const axios = require('axios');
    
    // Получаем текущие настройки
    let settings = await Settings.findOne({}) || new Settings({});
    const existingGroups = settings.vkGroups || [];
    
    // Создаем Map существующих групп для быстрого доступа
    const existingGroupsMap = new Map();
    existingGroups.forEach(group => {
      existingGroupsMap.set(group.id, {
        name: group.name,
        screen_name: group.screen_name
      });
    });
    
    // Получаем токен для запроса к API
    const token = await vkAuthService.getActiveToken(['groups']);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Не найден активный токен ВКонтакте с правами на доступ к группам',
        success: false
      });
    }
    
    // Запрашиваем актуальный список групп из API
    const response = await axios.get('https://api.vk.com/method/groups.get', {
      params: {
        access_token: token.accessToken,
        filter: 'admin',
        extended: 1,
        fields: 'screen_name', // Запрашиваем доменное имя
        v: '5.131'
      },
      timeout: 5000
    });
    
    if (response.data.error) {
      throw new Error(`VK API Error: ${response.data.error.error_msg}`);
    }
    
    const freshGroups = response.data.response.items || [];
    const updatedGroups = [];
    let newGroupsCount = 0;
    let updatedGroupsCount = 0;
    
    // Обрабатываем полученные группы
    freshGroups.forEach(group => {
      const groupId = `-${group.id}`;
      
      // Форматируем группу с доменным именем
      const formattedGroup = {
        id: groupId,
        name: group.name,
        screen_name: group.screen_name || null // Сохраняем доменное имя
      };
      
      if (existingGroupsMap.has(groupId)) {
        // Группа уже существует, проверяем необходимость обновления
        const existingGroup = existingGroupsMap.get(groupId);
        
        if (existingGroup.name !== group.name || existingGroup.screen_name !== group.screen_name) {
          // Имя или доменное имя изменилось, обновляем
          updatedGroupsCount++;
        }
        
        // Удаляем из Map, чтобы в конце там остались только группы, которых нет в свежем списке
        existingGroupsMap.delete(groupId);
      } else {
        // Новая группа, которой не было в существующем списке
        newGroupsCount++;
      }
      
      updatedGroups.push(formattedGroup);
    });
    
    // Добавляем обратно группы, которые остались в Map (они не пришли в свежем списке)
    // но мы их сохраняем, как вы указали
    existingGroupsMap.forEach((value, key) => {
      updatedGroups.push({
        id: key,
        name: value.name,
        screen_name: value.screen_name
      });
    });
    
    // Сохраняем обновленный список групп в настройки
    settings.vkGroups = updatedGroups;
    await settings.save();
    
    res.json({
      success: true,
      totalGroups: updatedGroups.length,
      newGroups: newGroupsCount,
      updatedGroups: updatedGroupsCount,
      message: `Список групп обновлен. Добавлено новых: ${newGroupsCount}, обновлено: ${updatedGroupsCount}.`
    });
    
  } catch (error) {
    console.error('Error refreshing VK groups:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Ошибка при обновлении списка групп'
    });
  }
});


/**
 * Получение текущих прав доступа
 * GET /api/vk-auth/permissions
 */
router.get('/permissions', async (req, res) => {
  try {
    const vkAuthService = require('../../services/vkAuthService');
    const axios = require('axios');
    
    // Получаем активный токен
    const token = await vkAuthService.getActiveToken();
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Не найден активный токен ВКонтакте',
        permissions: 0,
        permissionList: []
      });
    }
    
    // Запрос к VK API для получения битовой маски прав
    const response = await axios.get('https://api.vk.com/method/account.getAppPermissions', {
      params: {
        access_token: token.accessToken,
        v: '5.131'
      },
      timeout: 5000
    });
    
    if (response.data.error) {
      throw new Error(`VK API Error: ${response.data.error.error_msg}`);
    }
    
    const permissionsMask = response.data.response || 0;
    
    // Определение прав на основе битовой маски
    const permissionsMap = {
      notify: { bit: 1, name: 'Уведомления', description: 'Отправка уведомлений пользователю' },
      friends: { bit: 2, name: 'Друзья', description: 'Доступ к друзьям' },
      photos: { bit: 4, name: 'Фотографии', description: 'Доступ к фотографиям' },
      audio: { bit: 8, name: 'Аудиозаписи', description: 'Доступ к аудиозаписям' },
      video: { bit: 16, name: 'Видеозаписи', description: 'Доступ к видеозаписям' },
      stories: { bit: 64, name: 'Истории', description: 'Доступ к историям' },
      pages: { bit: 128, name: 'Страницы', description: 'Доступ к wiki-страницам' },
      menu: { bit: 256, name: 'Меню', description: 'Добавление ссылки в меню слева' },
      status: { bit: 1024, name: 'Статус', description: 'Доступ к статусу пользователя' },
      notes: { bit: 2048, name: 'Заметки', description: 'Доступ к заметкам пользователя' },
      messages: { bit: 4096, name: 'Сообщения', description: 'Доступ к сообщениям пользователя' },
      wall: { bit: 8192, name: 'Стена', description: 'Доступ к методам работы со стеной' },
      ads: { bit: 32768, name: 'Реклама', description: 'Доступ к рекламному API' },
      offline: { bit: 65536, name: 'Оффлайн-доступ', description: 'Доступ к API в любое время (бессрочный токен)' },
      docs: { bit: 131072, name: 'Документы', description: 'Доступ к документам' },
      groups: { bit: 262144, name: 'Группы', description: 'Доступ к группам пользователя' },
      notifications: { bit: 524288, name: 'Оповещения', description: 'Доступ к оповещениям об ответах' },
      stats: { bit: 1048576, name: 'Статистика', description: 'Доступ к статистике групп и приложений' },
      email: { bit: 4194304, name: 'Email', description: 'Доступ к email пользователя' },
      market: { bit: 134217728, name: 'Товары', description: 'Доступ к товарам' },
      phone_number: { bit: 268435456, name: 'Телефон', description: 'Доступ к номеру телефона' },
    };
    
    // Определяем наличие каждого права через побитовое "И" (&)
    const grantedPermissions = [];
    for (const [permission, info] of Object.entries(permissionsMap)) {
      if (permissionsMask & info.bit) {
        grantedPermissions.push({
          key: permission,
          name: info.name,
          description: info.description,
          bit: info.bit
        });
      }
    }
    
    // Отправляем результат
    res.json({
      success: true,
      permissionsMask,
      grantedPermissions,
      // Также отправляем расшифровку строкой для удобства
      permissionsDescription: grantedPermissions.map(p => p.name).join(', ')
    });
    
  } catch (error) {
    console.error('Error getting VK permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Ошибка при получении прав доступа',
      permissions: 0,
      permissionList: []
    });
  }
});

module.exports = router;
