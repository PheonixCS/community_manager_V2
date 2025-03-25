const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Ошибки S3
  if (err.code === 'NoSuchKey' || err.code === 'NoSuchBucket') {
    return res.status(404).json({
      error: 'Медиафайл не найден в хранилище',
      details: err.message
    });
  }

  // Общие ошибки
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
