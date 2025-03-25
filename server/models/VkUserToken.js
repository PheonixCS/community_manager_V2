const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VkUserTokenSchema = new Schema({
  // ID пользователя ВКонтакте
  vkUserId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Имя пользователя для отображения
  vkUserName: {
    type: String,
    required: true
  },
  
  // Токен доступа
  accessToken: {
    type: String,
    required: true
  },
  
  // Refresh token для обновления
  refreshToken: {
    type: String
  },
  
  // Время истечения токена (unixtime)
  expiresAt: {
    type: Number
  },
  
  // Массив разрешений, которые есть у токена
  scope: {
    type: [String],
    default: []
  },
  
  // Статус активности токена
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Дата и время последнего использования
  lastUsed: {
    type: Date
  },
  
  // Дата и время последнего обновления токена
  lastRefreshed: {
    type: Date
  },
  
  // Информация о пользователе ВК 
  userInfo: {
    type: Schema.Types.Mixed
  }
}, { 
  timestamps: true 
});

// Метод для проверки, истек ли токен
VkUserTokenSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return Math.floor(Date.now() / 1000) >= this.expiresAt;
};

// Статичный метод для поиска активного токена с нужными разрешениями (исправлен)
VkUserTokenSchema.statics.findActiveWithScope = async function(requiredScopes) {
  const scopeArray = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
  
  // Находим все активные токены
  const activeTokens = await this.find({
    isActive: true,
    expiresAt: { $gt: Math.floor(Date.now() / 1000) }
  });
  
  // Ранжируем токены по количеству совпадающих scope
  let bestToken = null;
  let bestMatch = 0;
  
  for (const token of activeTokens) {
    // Количество совпадающих scope
    const matchCount = scopeArray.filter(scope => 
      token.scope && token.scope.includes(scope)
    ).length;
    
    if (matchCount > bestMatch) {
      bestMatch = matchCount;
      bestToken = token;
    }
    
    // Если нашли полное совпадение, возвращаем сразу
    if (matchCount === scopeArray.length) {
      return token;
    }
  }
  
  // Если есть хотя бы частичное совпадение, возвращаем лучший результат
  if (bestToken && bestMatch > 0) {
    return bestToken;
  }
  
  // Если не нашли совпадений, но есть активные токены - возвращаем первый
  if (activeTokens.length > 0) {
    return activeTokens[0];
  }
  
  return null;
};

module.exports = mongoose.model('VkUserToken', VkUserTokenSchema);
