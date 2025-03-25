const express = require('express');
const router = express.Router();
const Settings = require('../../models/Settings');

// Получить текущие настройки
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить группы VK
router.get('/vk-groups', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    res.json(settings?.vkGroups || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить настройки
router.put('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }
    
    Object.assign(settings, req.body);
    settings.updatedAt = new Date();
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
