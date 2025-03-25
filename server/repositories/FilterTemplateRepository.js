const BaseRepository = require('./BaseRepository');
const FilterTemplate = require('../models/FilterTemplate');

class FilterTemplateRepository extends BaseRepository {
  constructor() {
    super(FilterTemplate);
  }

  /**
   * Создать новый шаблон фильтра с обработкой полей mediaFilters
   * @param {Object} data - Данные шаблона
   * @returns {Promise<Document>} Созданный шаблон
   */
  async createTemplate(data) {
    // Предобработка медиа-фильтров для обеспечения числовых значений
    if (data.mediaFilters) {
      for (const type in data.mediaFilters) {
        if (typeof data.mediaFilters[type] === 'object') {
          // Преобразуем строковые значения в числовые для min и max
          if (data.mediaFilters[type].min !== undefined) {
            data.mediaFilters[type].min = Number(data.mediaFilters[type].min);
          } else {
            data.mediaFilters[type].min = 0;
          }
          
          if (data.mediaFilters[type].max !== undefined) {
            data.mediaFilters[type].max = Number(data.mediaFilters[type].max);
          } else {
            data.mediaFilters[type].max = -1;
          }
        }
      }
    }
    
    return await this.create(data);
  }

  /**
   * Обновить шаблон фильтра с обработкой полей mediaFilters
   * @param {string} id - ID шаблона
   * @param {Object} data - Новые данные
   * @returns {Promise<Document|null>} Обновленный шаблон или null
   */
  async updateTemplate(id, data) {
    // Предобработка медиа-фильтров для обеспечения числовых значений
    if (data.mediaFilters) {
      for (const type in data.mediaFilters) {
        if (typeof data.mediaFilters[type] === 'object') {
          // Преобразуем строковые значения в числовые для min и max
          if (data.mediaFilters[type].min !== undefined) {
            data.mediaFilters[type].min = Number(data.mediaFilters[type].min);
          }
          
          if (data.mediaFilters[type].max !== undefined) {
            data.mediaFilters[type].max = Number(data.mediaFilters[type].max);
          }
        }
      }
    }
    
    return await this.update(id, { ...data, updatedAt: new Date() });
  }

  /**
   * Найти шаблоны по частичному совпадению имени
   * @param {string} name - Часть имени для поиска
   * @returns {Promise<Document[]>} Массив найденных шаблонов
   */
  async findByName(name) {
    return await this.findAll({ 
      name: { $regex: name, $options: 'i' } 
    });
  }
}

module.exports = new FilterTemplateRepository();
