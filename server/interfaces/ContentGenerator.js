/**
 * Интерфейс для генераторов контента
 * @interface
 */
class ContentGenerator {
  /**
   * Идентификатор генератора контента
   * @returns {string} Уникальный ID генератора
   */
  getId() {
    throw new Error('Method getId() must be implemented');
  }

  /**
   * Имя генератора контента (для отображения в UI)
   * @returns {string} Название генератора
   */
  getName() {
    throw new Error('Method getName() must be implemented');
  }

  /**
   * Генерация контента
   * @param {Object} params - Параметры для генерации контента
   * @returns {Promise<Object>} Объект с данными поста (текст, вложения и т.д.)
   */
  async generateContent(params) {
    throw new Error('Method generateContent() must be implemented');
  }

  /**
   * Получение описания параметров генератора
   * @returns {Array<Object>} Массив описаний параметров (имя, тип, значение по умолчанию, описание)
   */
  getParamsDescription() {
    throw new Error('Method getParamsDescription() must be implemented');
  }
}

module.exports = ContentGenerator;
