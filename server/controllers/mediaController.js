const s3Service = require('../services/s3Service');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Фильтр для проверки типа файла
const fileFilter = (req, file, cb) => {
  // Принимаем только изображения
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены только изображения.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Ограничение размера файла (10 МБ)
  },
  fileFilter: fileFilter
});

// Контроллер для загрузки медиафайлов
exports.uploadMedia = async (req, res) => {
  try {
    // Multer загружает файл на диск
    upload.single('file')(req, res, async function (err) {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Файл не был загружен'
        });
      }

      try {
        // Загружаем файл в S3
        const fileStream = fs.createReadStream(req.file.path);
        const uploadPath = `media/custom/${path.basename(req.file.path)}`;
        
        const result = await s3Service.uploadFile(fileStream, uploadPath, req.file.mimetype);
        
        // Удаляем временный файл
        await unlinkAsync(req.file.path);
        
        res.status(200).json({
          success: true,
          url: result.location || result.Location,
          key: result.key || result.Key
        });
      } catch (uploadError) {
        console.error('Error uploading to S3:', uploadError);
        
        // Удаляем временный файл в случае ошибки
        try {
          await unlinkAsync(req.file.path);
        } catch (e) {
          console.error('Error deleting temp file:', e);
        }
        
        return res.status(500).json({
          success: false,
          error: 'Ошибка при загрузке файла на сервер хранения'
        });
      }
    });
  } catch (error) {
    console.error('Error in uploadMedia controller:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
};
