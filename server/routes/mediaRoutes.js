const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');

/**
 * @route POST /api/media/upload
 * @desc Загрузка медиафайла для кастомизации постов
 * @access Private
 */
router.post('/upload', mediaController.uploadMedia);

module.exports = router;
