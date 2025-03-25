import axios from 'axios';

/**
 * Сервис для работы с задачами скрапинга
 */
const taskService = {
  /**
   * Получение списка задач скрапинга
   * @param {Object} params - Параметры запроса (фильтры, пагинация)
   * @returns {Promise<Array>} Массив задач
   */
  getTasks: async (params = {}) => {
    const response = await axios.get('/api/tasks', { params });
    return response.data;
  },

  /**
   * Получение задачи по ID
   * @param {string} id - ID задачи
   * @returns {Promise<Object>} Данные задачи
   */
  getTask: async (id) => {
    const response = await axios.get(`/api/tasks/${id}`);
    return response.data;
  },
  
  /**
   * Запуск задачи вручную
   * @param {string} id - ID задачи
   * @returns {Promise<Object>} Результат выполнения
   */
  runTask: async (id) => {
    const response = await axios.post(`/api/tasks/${id}/run`);
    return response.data;
  },
  
  /**
   * Включение/выключение задачи
   * @param {string} id - ID задачи
   * @returns {Promise<Object>} Обновленная задача
   */
  toggleTask: async (id) => {
    const response = await axios.patch(`/api/tasks/${id}/toggle`);
    return response.data;
  }
};

export default taskService;
