const dummyGenerator = require('../generators/DummyContentGenerator');

/**
 * Сервис для работы с генераторами контента
 */
class ContentGeneratorService {
  constructor() {
    // Регистрируем доступные генераторы
    this.generators = new Map();
    this.registerGenerator(dummyGenerator);
  }

  /**
   * Регистрация генератора контента
   * @param {ContentGenerator} generator - Экземпляр генератора
   */
  registerGenerator(generator) {
    const id = generator.getId();
    this.generators.set(id, generator);
    console.log(`Content generator "${generator.getName()}" (${id}) registered`);
  }

  /**
   * Получение списка доступных генераторов
   * @returns {Array<Object>} Массив с информацией о генераторах
   */
  getAvailableGenerators() {
    const result = [];
    for (const [id, generator] of this.generators.entries()) {
      result.push({
        id,
        name: generator.getName(),
        params: generator.getParamsDescription()
      });
    }
    return result;
  }

  /**
   * Получение генератора по ID
   * @param {string} generatorId - ID генератора
   * @returns {ContentGenerator|null} Экземпляр генератора или null
   */
  getGenerator(generatorId) {
    return this.generators.get(generatorId) || null;
  }

  /**
   * Генерация контента
   * @param {string} generatorId - ID генератора
   * @param {Object} params - Параметры для генерации
   * @returns {Promise<Object|null>} Сгенерированный контент или null
   */
  async generateContent(generatorId, params = {}) {
    const generator = this.getGenerator(generatorId);
    
    if (!generator) {
      console.error(`Content generator with ID "${generatorId}" not found`);
      return null;
    }
    
    try {
      console.log(`Generating content using "${generator.getName()}" with params:`, params);
      return await generator.generateContent(params);
    } catch (error) {
      console.error(`Error generating content with generator "${generatorId}":`, error);
      return null;
    }
  }
}

module.exports = new ContentGeneratorService();
