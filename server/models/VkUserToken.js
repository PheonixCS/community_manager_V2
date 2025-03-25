const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VkUserTokenSchema = new Schema({
  // Пользователь ВК, которому принадлежит токен
  vkUserId: {
    type: String,
    required: true,
    index: true
  },
  
  // Имя пользователя (для отображения в интерфейсе)
  vkUserName: {
    type: String,
    required: true
  },
  
  // Токен доступа
  accessToken: {
    type: String,
    required: true
  },
  
  // Токен обновления для получения нового access_token когда текущий истечет
  refreshToken: {
    type: String
  },
  
  // Время истечения токена доступа в формате UNIX timestamp
  expiresAt: {
    type: Number,
    required: true
  },
  
  // Список разрешений, которые были запрошены при получении токена
  scope: {
    type: [String],
    default: []
  },
  
  // Флаг активности токена (можно деактивировать токен без удаления)
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Дата последнего использования токена
  lastUsed: {
    type: Date
  },
  
  // Дата последнего обновления токена
  lastRefreshed: {
    type: Date
  },
  
  // Дополнительная информация о пользователе (аватар, URL профиля и т.д.)
  userInfo: {
    type: Schema.Types.Mixed
  },
  
  // Метаданные
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Метод проверки истечения токена
VkUserTokenSchema.methods.isExpired = function() {
  // Запас в 5 минут, чтобы успеть обновить токен до его фактического истечения
  const bufferTime = 5 * 60; // 5 минут в секундах
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime + bufferTime >= this.expiresAt;
};

// Метод проверки наличия нужных разрешений
VkUserTokenSchema.methods.hasScope = function(requiredScope) {
  if (!Array.isArray(requiredScope)) {
    requiredScope = [requiredScope];
  }
  
  return requiredScope.every(scopeItem => this.scope.includes(scopeItem));
};

// Статический метод для поиска активного токена с нужными разрешениями
VkUserTokenSchema.statics.findActiveWithScope = async function(requiredScope) {
  const tokens = await this.find({ isActive: true }).sort({ updatedAt: -1 });
  
  for (const token of tokens) {
    if (!token.isExpired() && token.hasScope(requiredScope)) {
      return token;
    }
  }
  
  return null;
};

module.exports = mongoose.model('VkUserToken', VkUserTokenSchema);
