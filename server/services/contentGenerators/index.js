/**
 * Индекс модуль для генераторов контента
 * Для простой отладки и централизованного управления генераторами
 */

const fs = require('fs');
const path = require('path');

// Автоматически обнаружить и экспортировать все генераторы
const generators = {};

// Загружаем все .js файлы, кроме этого индексного файла
fs.readdirSync(__dirname)
  .filter(file => file.endsWith('.js') && file !== 'index.js')
  .forEach(file => {
    try {
      const generatorPath = path.join(__dirname, file);
      const generator = require(generatorPath);
      
      if (generator && generator.id) {
        generators[generator.id] = generator;
        console.log(`Index: Registered generator ${generator.id} from ${file}`);
      } else {
        console.warn(`Index: File ${file} does not export a valid generator`);
      }
    } catch (error) {
      console.error(`Index: Error loading generator from ${file}:`, error);
    }
  });

console.log(`Index: Registered ${Object.keys(generators).length} generators`);

module.exports = generators;
