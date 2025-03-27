const fs = require('fs');
const path = require('path');


/**
 * Service for managing and executing content generators
 */
class ContentGeneratorService {
  constructor() {
    this.generators = [];
    this.isInitialized = false;
    this.generatorsDir = path.join(__dirname, 'contentGenerators');
    this.generatorRegistry = null;
  }

  /**
   * Initialize the service and load all generators
   */
  initialize() {
    // logger.info('Initializing ContentGeneratorService');
    this.loadGenerators();
    this.isInitialized = true;
    return Promise.resolve();
  }

  /**
   * Load all available generators
   */
  async loadGenerators() {
    try {
      // Clear existing generators
      this.generators = [];

      // Check if generators directory exists
      if (!fs.existsSync(this.generatorsDir)) {
        // logger.warn(`Generators directory not found: ${this.generatorsDir}`);
        return;
      }

      // Try to load the generator registry
      const registryPath = path.join(this.generatorsDir, 'index.js');
      if (fs.existsSync(registryPath)) {
        try {
          // Clear require cache to ensure fresh load
          delete require.cache[require.resolve(registryPath)];
          
          // Load the registry
          this.generatorRegistry = require(registryPath);
          
          // If registry has registerGenerators function, use it
          if (this.generatorRegistry && typeof this.generatorRegistry.registerGenerators === 'function') {
            const registeredGenerators = await this.generatorRegistry.registerGenerators();
            
            if (Array.isArray(registeredGenerators)) {
              this.generators = [...registeredGenerators];
              // logger.info(`Loaded ${this.generators.length} generators from registry`);
            } else {
              // logger.warn('Generator registry did not return an array');
            }
            
            // If registry is exclusive, return early
            if (this.generatorRegistry.exclusiveRegistration === true) {
              return;
            }
          }
        } catch (registryError) {
          // logger.error('Error loading generator registry:', registryError);
        }
      }

      // Load individual generator files
      const files = fs.readdirSync(this.generatorsDir);
      
      for (const file of files) {
        if (file !== 'index.js' && file.endsWith('.js') && !file.startsWith('_')) {
          const fullPath = path.join(this.generatorsDir, file);
          
          try {
            // Clear require cache for this file
            delete require.cache[require.resolve(fullPath)];
            
            // Load the generator module
            const generatorModule = require(fullPath);
            
            // Handle direct generator exports
            if (generatorModule && generatorModule.id && typeof generatorModule.generateContent === 'function') {
              // Check if generator with this ID already exists
              const existingIndex = this.generators.findIndex(g => g.id === generatorModule.id);
              
              if (existingIndex >= 0) {
                // Replace existing generator
                this.generators[existingIndex] = generatorModule;
                // logger.info(`Updated generator: ${generatorModule.id}`);
              } else {
                // Add new generator
                this.generators.push(generatorModule);
                // logger.info(`Loaded generator: ${generatorModule.id}`);
              }
            } 
            // Handle wrapped generators (checks for map function from wrapped export)
            else if (generatorModule && typeof generatorModule.map === 'function') {
              const wrappedGen = generatorModule;
              // If it has the required properties directly, register it too
              if (wrappedGen.id && typeof wrappedGen.generateContent === 'function') {
                const existingIndex = this.generators.findIndex(g => g.id === wrappedGen.id);
                
                if (existingIndex >= 0) {
                  this.generators[existingIndex] = wrappedGen;
                  // logger.info(`Updated wrapped generator: ${wrappedGen.id}`);
                } else {
                  this.generators.push(wrappedGen);
                  // logger.info(`Loaded wrapped generator: ${wrappedGen.id}`);
                }
              }
            }
            // Handle modules with getGenerators function
            else if (generatorModule && typeof generatorModule.getGenerators === 'function') {
              try {
                const moduleGenerators = await generatorModule.getGenerators();
                
                if (Array.isArray(moduleGenerators)) {
                  for (const gen of moduleGenerators) {
                    if (gen && gen.id && typeof gen.generateContent === 'function') {
                      const existingIndex = this.generators.findIndex(g => g.id === gen.id);
                      
                      if (existingIndex >= 0) {
                        this.generators[existingIndex] = gen;
                        // logger.info(`Updated generator: ${gen.id}`);
                      } else {
                        this.generators.push(gen);
                        // logger.info(`Loaded generator: ${gen.id}`);
                      }
                    }
                  }
                }
              } catch (error) {
                // logger.error(`Error calling getGenerators for ${file}:`, error);
              }
            }
          } catch (error) {
            // logger.error(`Error loading generator from ${file}:`, error);
          }
        }
      }

      // logger.info(`Total loaded generators: ${this.generators.length}`);
    } catch (error) {
      // logger.error('Error loading generators:', error);
    }
  }

  /**
   * Get all available generators
   */
  getAvailableGenerators() {
    return this.generators;
  }

  /**
   * Generate content using specified generator
   * @param {string} generatorId - ID of the generator to use
   * @param {object} params - Parameters to pass to the generator
   * @returns {Promise<object>} Generated content
   */
  async generateContent(generatorId, params = {}) {
    try {
      const generator = this.generators.find(g => g.id === generatorId);
      
      if (!generator) {
        throw new Error(`Generator not found: ${generatorId}`);
      }
      
      if (typeof generator.generateContent !== 'function') {
        throw new Error(`Invalid generator: ${generatorId} (missing generateContent method)`);
      }
      
      return await generator.generateContent(params);
    } catch (error) {
      logger.error(`Error generating content with ${generatorId}:`, error);
      throw error;
    }
  }
}

module.exports = new ContentGeneratorService();
