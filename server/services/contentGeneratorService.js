const fs = require('fs');
const path = require('path');

/**
 * Сервис для управления генераторами контента
 */
class ContentGeneratorService {
  constructor() {
    this.generators = new Map();
    this.loadGenerators();
  }

  /**
   * Загружает все доступные генераторы контента
   */
  loadGenerators() {
    try {
      // Загружаем встроенные генераторы
      const generatorsPath = path.join(__dirname, 'contentGenerators');
      if (fs.existsSync(generatorsPath)) {
        fs.readdirSync(generatorsPath)
          .filter(file => file.endsWith('.js'))
          .forEach(file => {
            try {
              const generator = require(path.join(generatorsPath, file));
              if (generator && generator.id && generator.generateContent) {
                this.generators.set(generator.id, generator);
                console.log(`Loaded content generator: ${generator.name || generator.id}`);
              }
            } catch (error) {
              console.error(`Error loading generator from file ${file}:`, error);
            }
          });
      }
      
      console.log(`Total content generators loaded: ${this.generators.size}`);
    } catch (error) {
      console.error('Error loading content generators:', error);
    }
  }

  /**
   * Генерирует контент с использованием указанного генератора
   * @param {string} generatorId - ID генератора
   * @param {Object} params - Параметры генерации
   * @returns {Promise<Object>} Сгенерированный контент
   */
  async generateContent(generatorId, params = {}) {
    try {
      const generator = this.generators.get(generatorId);
      
      if (!generator) {
        throw new Error(`Generator with ID "${generatorId}" not found`);
      }
      
      console.log(`Generating content with ${generator.name || generator.id}...`);
      
      // Передаем управление генератору
      const content = await generator.generateContent(params);
      
      if (!content) {
        throw new Error('Generator returned empty content');
      }
      
      // Проверяем обязательные поля
      if (typeof content.text !== 'string' && !Array.isArray(content.attachments)) {
        throw new Error('Generated content must have either text or attachments');
      }
      
      return content;
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    }
  }

  /**
   * Получение доступных генераторов контента
   * @returns {Array<Object>} Массив генераторов
   */
  getAvailableGenerators() {
    // Возвращаем массив с информацией о генераторах (без методов)
    return Array.from(this.generators.values()).map(generator => ({
      id: generator.id,
      name: generator.name || generator.id,
      description: generator.description || '',
      params: generator.params || []
    }));
  }

  /**
   * Получение параметров генератора по ID
   * @param {string} generatorId - ID генератора
   * @returns {Array<Object>} Массив параметров
   */
  getGeneratorParams(generatorId) {
    const generator = this.generators.get(generatorId);
    return generator ? generator.params || [] : [];
  }
}

module.exports = new ContentGeneratorService();
