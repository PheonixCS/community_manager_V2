const fs = require('fs');
const path = require('path');

/**
 * Сервис для управления генераторами контента
 */
class ContentGeneratorService {
  constructor() {
    this.generators = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.loadGenerators();
      this.initialized = true;
      console.log(`ContentGeneratorService initialized successfully with ${this.generators.size} generators`);
    } catch (error) {
      console.error('Failed to initialize ContentGeneratorService:', error);
      throw error;
    }
  }

  /**
   * Загружает все доступные генераторы контента
   */
  async loadGenerators() {
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
      
      // Очищаем текущие генераторы перед загрузкой
      this.generators.clear();
      
      // First, try to load the index file if it exists
      const indexPath = path.join(generatorsPath, 'index.js');
      if (fs.existsSync(indexPath)) {
        try {
          console.log('Found index.js file, trying to load generators from index');
          delete require.cache[require.resolve(indexPath)];
          
          const indexModule = require(indexPath);
          if (indexModule && typeof indexModule.registerGenerators === 'function') {
            // If index has a registerGenerators function, use it
            const registeredGenerators = await indexModule.registerGenerators();
            if (Array.isArray(registeredGenerators)) {
              for (const generator of registeredGenerators) {
                if (generator && generator.id && typeof generator.generateContent === 'function') {
                  this.generators.set(generator.id, generator);
                  console.log(`Successfully loaded content generator from index: ${generator.name || generator.id}`);
                }
              }
            }
            // If index handled registration, we might be done
            if (this.generators.size > 0 && indexModule.exclusiveRegistration === true) {
              console.log(`Index registered ${this.generators.size} generators exclusively`);
              return;
            }
          }
        } catch (error) {
          console.error('Error loading generators from index.js:', error);
          // Continue with individual file loading as fallback
        }
      }
      
      // Load individual files
      const files = fs.readdirSync(generatorsPath);
      console.log(`Found ${files.length} files in generators directory`);
      
      const generatorFiles = files.filter(file => 
        file.endsWith('.js') && file !== 'index.js' && !file.includes('Bridge')
      );
      console.log(`Found ${generatorFiles.length} potential generator files`);
      
      for (const file of generatorFiles) {
        try {
          console.log(`Attempting to load generator from file: ${file}`);
          const modulePath = path.join(generatorsPath, file);
          delete require.cache[require.resolve(modulePath)];
          
          const generator = require(modulePath);
          
          if (generator && generator.id && typeof generator.generateContent === 'function') {
            this.generators.set(generator.id, generator);
            console.log(`Successfully loaded content generator: ${generator.name || generator.id}`);
          } else if (generator && typeof generator.getGenerators === 'function') {
            // Handle modules that export multiple generators
            const moduleGenerators = await generator.getGenerators();
            if (Array.isArray(moduleGenerators)) {
              for (const gen of moduleGenerators) {
                if (gen.id && typeof gen.generateContent === 'function') {
                  this.generators.set(gen.id, gen);
                  console.log(`Successfully loaded content generator: ${gen.name || gen.id}`);
                }
              }
            }
          } else {
            console.warn(`Skipping invalid generator in file ${file}. Missing id or generateContent method.`);
            if (generator) {
              console.warn(`Generator details: id=${generator.id}, hasGenerateMethod=${!!generator.generateContent}`);
            }
          }
        } catch (error) {
          console.error(`Error loading generator from file ${file}:`, error);
        }
      }
      
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
      throw error;
    }
  }

  /**
   * Генерирует контент с использованием указанного генератора
   * @param {string} generatorId - ID генератора
   * @param {Object} params - Параметры генерации
   * @returns {Promise<Object>} Сгенерированный контент
   */
  async generateContent(generatorId, params = {}) {
    // Make sure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      console.log(`Attempting to generate content with generator: ${generatorId}`);
      console.log('Generator params:', JSON.stringify(params, null, 2));
      
      // Ensure carouselMode is set with proper default for image content
      if (params.imageType === 'image') {
        params.carouselMode = params.carouselMode !== false; // Default to true if not explicitly false
        console.log(`Using carouselMode=${params.carouselMode} for content generation`);
      }
      
      // Reload generators if needed
      if (this.generators.size === 0) {
        console.log('No generators loaded, attempting to load them now');
        await this.loadGenerators();
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
      
      // Explicitly preserve carouselMode if it exists in params for image content
      if (params.imageType === 'image' && 'carouselMode' in params) {
        content.isCarousel = params.carouselMode && content.attachments && content.attachments.length > 1;
        console.log(`Setting isCarousel to ${content.isCarousel} based on params`);
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
  async getAvailableGenerators() {
    // Make sure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
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
  async getGeneratorParams(generatorId) {
    // Make sure service is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    const generator = this.generators.get(generatorId);
    return generator ? generator.params || [] : [];
  }

  /**
   * Reload generators (useful for development and testing)
   */
  async reloadGenerators() {
    console.log('Reloading content generators...');
    await this.loadGenerators();
    return this.getAvailableGenerators();
  }
}

// Create a singleton instance
const contentGeneratorService = new ContentGeneratorService();

module.exports = contentGeneratorService;
