/**
 * Content Generator Registry
 * This file manages loading and registering all content generators
 */
const fs = require('fs');
const path = require('path');

// Set to false to allow individual generators to be loaded separately
// Set to true if this index should be the exclusive source of generators
exports.exclusiveRegistration = false;

/**
 * Register all generators from this directory
 * @returns {Array} Array of registered generator objects
 */
exports.registerGenerators = async function() {
  console.log('Registering content generators...');
  const generators = [];
  const currentDir = __dirname;
  
  try {
    // Get all js files in the directory
    const files = fs.readdirSync(currentDir);
    const generatorFiles = files.filter(
      file => file.endsWith('.js') && 
             file !== 'index.js' &&
             !file.startsWith('_')
    );
    
    console.log(`Found ${generatorFiles.length} potential generator files`);
    
    // Load each generator file
    for (const file of generatorFiles) {
      try {
        console.log(`Index: Trying to register generator from ${file}`);
        const modulePath = path.join(currentDir, file);
        delete require.cache[require.resolve(modulePath)];
        
        const module = require(modulePath);
        
        // Handle direct generator export
        if (module && module.id && typeof module.generateContent === 'function') {
          generators.push(module);
          console.log(`Index: Registered generator ${module.id} from ${file}`);
        } 
        // Handle modules that export multiple generators
        else if (module && typeof module.getGenerators === 'function') {
          const moduleGenerators = await module.getGenerators();
          if (Array.isArray(moduleGenerators)) {
            for (const gen of moduleGenerators) {
              if (gen && gen.id && typeof gen.generateContent === 'function') {
                generators.push(gen);
                console.log(`Index: Registered generator ${gen.id} from ${file}`);
              }
            }
          }
        } else {
          console.log(`Index: File ${file} does not export a valid generator`);
        }
      } catch (error) {
        console.error(`Index: Error loading generator from ${file}:`, error);
      }
    }
    
    console.log(`Index: Registered ${generators.length} generators`);
    return generators;
  } catch (error) {
    console.error('Error in generator registration:', error);
    return [];
  }
};
