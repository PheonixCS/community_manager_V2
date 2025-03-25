const ContentGenerator = require('../interfaces/ContentGenerator');

/**
 * Генератор-заглушка для тестирования
 */
class DummyContentGenerator extends ContentGenerator {
  /**
   * Идентификатор генератора контента
   * @returns {string} Уникальный ID генератора
   */
  getId() {
    return 'dummy-generator';
  }

  /**
   * Имя генератора контента (для отображения в UI)
   * @returns {string} Название генератора
   */
  getName() {
    return 'Тестовый генератор';
  }

  /**
   * Генерация тестового контента
   * @param {Object} params - Параметры для генерации контента
   * @returns {Promise<Object>} Объект с данными поста
   */
  async generateContent(params = {}) {
    const timestamp = new Date().toISOString();
    
    // Генерируем тестовый пост с учетом переданных параметров
    return {
      text: params.customText || `Тестовый пост, сгенерированный в ${timestamp}. ${params.addHashtags ? '#тест #demo' : ''}`,
      attachments: []
    };
  }

  /**
   * Получение описания параметров генератора
   * @returns {Array<Object>} Массив описаний параметров
   */
  getParamsDescription() {
    return [
      {
        name: 'customText',
        type: 'string',
        defaultValue: '',
        description: 'Пользовательский текст для включения в пост'
      },
      {
        name: 'addHashtags',
        type: 'boolean',
        defaultValue: false,
        description: 'Добавлять ли хэштеги в конец поста'
      }
    ];
  }
}

module.exports = new DummyContentGenerator();
