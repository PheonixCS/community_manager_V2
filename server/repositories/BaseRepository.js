/**
 * Базовый репозиторий с общими методами CRUD операций
 */
class BaseRepository {
  /**
   * @param {Model} model - Mongoose модель
   */
  constructor(model) {
    this.model = model;
  }

  /**
   * Создать новую запись
   * @param {Object} data - Данные для создания
   * @returns {Promise<Document>} Созданный документ
   */
  async create(data) {
    return await this.model.create(data);
  }

  /**
   * Найти запись по ID
   * @param {string} id - ID документа
   * @returns {Promise<Document|null>} Найденный документ или null
   */
  async findById(id) {
    return await this.model.findById(id);
  }

  /**
   * Найти все записи с применением фильтров, сортировки и пагинации
   * @param {Object} filter - Фильтр Mongoose
   * @param {Object} options - Опции (сортировка, пагинация)
   * @returns {Promise<Document[]>} Массив документов
   */
  async findAll(filter = {}, options = {}) {
    const { sort = {}, limit, skip, populate } = options;
    
    let query = this.model.find(filter);
    
    if (Object.keys(sort).length > 0) {
      query = query.sort(sort);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    if (skip) {
      query = query.skip(skip);
    }
    
    if (populate) {
      query = query.populate(populate);
    }
    
    return await query.exec();
  }

  /**
   * Обновить запись по ID
   * @param {string} id - ID документа
   * @param {Object} data - Данные для обновления
   * @param {Object} options - Опции обновления
   * @returns {Promise<Document|null>} Обновленный документ или null
   */
  async update(id, data, options = { new: true }) {
    return await this.model.findByIdAndUpdate(id, data, options);
  }

  /**
   * Удалить запись по ID
   * @param {string} id - ID документа
   * @returns {Promise<Document|null>} Удаленный документ или null
   */
  async delete(id) {
    return await this.model.findByIdAndDelete(id);
  }

  /**
   * Выполнить произвольный запрос с агрегацией
   * @param {Array} pipeline - Массив операций агрегации
   * @returns {Promise<any[]>} Результат агрегации
   */
  async aggregate(pipeline) {
    return await this.model.aggregate(pipeline);
  }

  /**
   * Подсчитать количество документов
   * @param {Object} filter - Фильтр
   * @returns {Promise<number>} Количество документов
   */
  async count(filter = {}) {
    return await this.model.countDocuments(filter);
  }
}

module.exports = BaseRepository;
