const express = require('express');
const router = express.Router();
const vkService = require('../../services/vkService');

/**
 * Получение списка групп пользователя ВКонтакте
 * GET /api/vk/groups
 */
router.get('/groups', async (req, res) => {
  try {
    const groups = await vkService.getUserGroups();
    res.json(groups);
  } catch (error) {
    console.error('Error fetching VK groups:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Получение информации о группе ВКонтакте
 * GET /api/vk/groups/:groupId
 */
router.get('/groups/:groupId', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const group = await vkService.getGroupInfo(groupId);
    res.json(group);
  } catch (error) {
    console.error(`Error fetching VK group ${req.params.groupId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Поиск групп ВКонтакте
 * GET /api/vk/search-groups
 */
router.get('/search-groups', async (req, res) => {
  try {
    const { query, count = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const groups = await vkService.searchGroups(query, count);
    res.json(groups);
  } catch (error) {
    console.error('Error searching VK groups:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
