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
      console.log('Loading content generators...');
      // Загружаем встроенные генераторы
      const generatorsPath = path.join(__dirname, 'contentGenerators');
      console.log(`Checking for generators in path: ${generatorsPath}`);
      
      if (!fs.existsSync(generatorsPath)) {
        console.warn(`Generators path does not exist: ${generatorsPath}`);
        fs.mkdirSync(generatorsPath, { recursive: true });
        console.log(`Created generators directory: ${generatorsPath}`);
      }
      
      const files = fs.readdirSync(generatorsPath);
      console.log(`Found ${files.length} files in generators directory`);
      
      const generatorFiles = files.filter(file => file.endsWith('.js'));
      console.log(`Found ${generatorFiles.length} JavaScript files in generators directory`);
      
      // Очищаем текущие генераторы перед загрузкой
      this.generators.clear();
      
      generatorFiles.forEach(file => {
        try {
          console.log(`Attempting to load generator from file: ${file}`);
          // Очищаем кеш модуля перед загрузкой, чтобы обеспечить свежую версию
          const modulePath = path.join(generatorsPath, file);
          delete require.cache[require.resolve(modulePath)];
          
          const generator = require(modulePath);
          
          if (generator && generator.id && typeof generator.generateContent === 'function') {
            this.generators.set(generator.id, generator);
            console.log(`Successfully loaded content generator: ${generator.name || generator.id}`);
          } else {
            console.warn(`Skipping invalid generator in file ${file}. Missing id or generateContent method.`);
            if (generator) {
              console.warn(`Generator details: id=${generator.id}, hasGenerateMethod=${!!generator.generateContent}`);
            }
          }
        } catch (error) {
          console.error(`Error loading generator from file ${file}:`, error);
        }
      });
      
      console.log(`Total content generators loaded: ${this.generators.size}`);
      if (this.generators.size === 0) {
        console.log('No generators were loaded. Check if the generator files exist and are valid.');
      } else {
        // Показать загруженные генераторы
        for (const [id, generator] of this.generators.entries()) {
          console.log(`> Loaded generator: ${id} (${generator.name || 'unnamed'})`);
        }
      }
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
      console.log(`Attempting to generate content with generator: ${generatorId}`);
      
      // Reload generators to ensure we have the latest version
      if (this.generators.size === 0) {
        console.log('No generators loaded, attempting to load them now');
        this.loadGenerators();
      }
      
      const generator = this.generators.get(generatorId);
      
      if (!generator) {
        console.error(`Generator with ID "${generatorId}" not found. Available generators: ${[...this.generators.keys()].join(', ')}`);
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
