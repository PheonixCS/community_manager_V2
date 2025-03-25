const AWS = require('aws-sdk');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');

class S3Service {
  constructor() {
    this.s3Client = new AWS.S3({
      endpoint: config.s3.endpoint,
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
      s3ForcePathStyle: true, // Важно для MinIO
      signatureVersion: 'v4'
    });
    
    this.bucket = config.s3.bucket;
    this.downloadDir = path.join(__dirname, '../downloads');
    fs.ensureDirSync(this.downloadDir);
    
    console.log('S3 Service initialized with endpoint:', config.s3.endpoint);
  }

  // Проверка на существование бакета
  async ensureBucketExists() {
    try {
      await this.s3Client.headBucket({ Bucket: this.bucket }).promise();
      console.log(`Бакет ${this.bucket} существует`);
    } catch (error) {
      if (error.statusCode === 404) {
        console.log(`Создаем бакет ${this.bucket}`);
        await this.s3Client.createBucket({
          Bucket: this.bucket
        }).promise();
        
        // Устанавливаем публичный доступ для чтения
        await this.s3Client.putBucketPolicy({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicRead',
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`]
              }
            ]
          })
        }).promise();
      } else {
        console.error('Ошибка при проверке бакета:', error);
        throw error;
      }
    }
  }

  // Загрузка файла в S3
  async uploadFile(fileBuffer, mimeType, folderName = 'default') {
    try {
      const fileName = `${folderName}/${uuidv4()}${this.getExtensionFromMimeType(mimeType)}`;
      
      const params = {
        Bucket: this.bucket,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType
      };
      
      const result = await this.s3Client.upload(params).promise();
      
      return {
        success: true,
        url: result.Location,
        key: result.Key
      };
    } catch (error) {
      console.error('Ошибка при загрузке файла в S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Загрузка файла в S3 из локального пути
  async uploadFileFromPath(filePath, folderName = 'default') {
    try {
      const fileContent = await fs.readFile(filePath);
      const fileName = path.basename(filePath);
      const mimeType = this.getMimeTypeFromFileName(fileName);
      
      const s3Key = `${folderName}/${uuidv4()}_${fileName}`;
      
      const params = {
        Bucket: this.bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: mimeType
      };
      
      const result = await this.s3Client.upload(params).promise();
      
      return {
        success: true,
        url: result.Location,
        key: result.Key
      };
    } catch (error) {
      console.error('Ошибка при загрузке файла в S3 из локального пути:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Добавляем метод для прямой загрузки из буфера данных
  async uploadFromBuffer(buffer, fileName, folderName = 'default', mimeType) {
    try {
      const s3Key = `${folderName}/${fileName}`;
      
      const params = {
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType
      };
      
      const result = await this.s3Client.upload(params).promise();
      
      return {
        success: true,
        url: result.Location,
        key: result.Key
      };
    } catch (error) {
      console.error('Error uploading buffer to S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Скачивание файла из S3
  async downloadFile(s3Key, localPath) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: s3Key
      };
      
      const data = await this.s3Client.getObject(params).promise();
      
      await fs.writeFile(localPath, data.Body);
      
      return {
        success: true,
        path: localPath
      };
    } catch (error) {
      console.error('Ошибка при скачивании файла из S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Удаление файла из S3
  async deleteFile(s3Key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: s3Key
      };
      
      await this.s3Client.deleteObject(params).promise();
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Ошибка при удалении файла из S3:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение расширения файла из MIME-типа
  getExtensionFromMimeType(mimeType) {
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav'
    };
    
    return mimeToExt[mimeType] || '';
  }

  // Получение MIME-типа из имени файла
  getMimeTypeFromFileName(fileName) {
    const extToMime = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav'
    };
    
    const ext = path.extname(fileName).toLowerCase();
    return extToMime[ext] || 'application/octet-stream';
  }

  // Получение публичного URL для объекта
  getPublicUrl(s3Key) {
    return `${config.s3.endpoint}/${this.bucket}/${s3Key}`;
  }
}

module.exports = new S3Service();
