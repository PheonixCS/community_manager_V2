const express = require('express');
const router = express.Router();
const cleanupService = require('../../services/cleanupService');

// Get current cleanup settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await cleanupService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching cleanup settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update cleanup settings
router.put('/settings', async (req, res) => {
  try {
    const updatedSettings = await cleanupService.updateSettings(req.body);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating cleanup settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run cleanup manually
router.post('/run', async (req, res) => {
  try {
    const result = await cleanupService.runCleanupManually();
    res.json(result);
  } catch (error) {
    console.error('Error running cleanup manually:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
