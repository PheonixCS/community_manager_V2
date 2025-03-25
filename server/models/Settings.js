const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  downloadMedia: {
    enabled: {
      type: Boolean,
      default: true
    },
    types: {
      photos: {
        type: Boolean,
        default: true
      },
      videos: {
        type: Boolean,
        default: true
      },
      documents: {
        type: Boolean,
        default: true
      },
      audio: {
        type: Boolean,
        default: true
      }
    }
  },
  storage: {
    type: {
      type: String,
      enum: ['local', 's3'],
      default: 's3'
    },
    keepLocalCopy: {
      type: Boolean,
      default: false
    }
  },
  vkApi: {
    serviceToken: {
      type: String,
      default: ''
    },
    apiVersion: {
      type: String,
      default: '5.131'
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Добавляем метод для преобразования в JSON, исключающий поле serviceToken
SettingsSchema.methods.toJSON = function() {
  const obj = this.toObject();
  obj.vkApi.serviceToken = obj.vkApi.serviceToken ? '••••••••' : '';
  return obj;
};

module.exports = mongoose.model('Settings', SettingsSchema);
