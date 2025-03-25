import axios from 'axios';

/**
 * Сервис для работы с API публикации
 */
const publishingService = {
  /**
   * Получение списка задач публикации
   * @param {Object} params - Параметры запроса (фильтры, пагинация)
   * @returns {Promise<Object>} Ответ с данными задач и пагинацией
   */
  getTasks: async (params = {}) => {
    const response = await axios.get('/api/publishing/tasks', { params });
    return response.data;
  },
  
  /**
   * Получение задачи по ID
   * @param {string} id - ID задачи
   * @returns {Promise<Object>} Данные задачи
   */
  getTask: async (id) => {
    const response = await axios.get(`/api/publishing/tasks/${id}`);
    return response.data;
  },
  
  /**
   * Создание новой задачи
   * @param {Object} taskData - Данные задачи
   * @returns {Promise<Object>} Созданная задача
   */
  createTask: async (taskData) => {
    const response = await axios.post('/api/publishing/tasks', taskData);
    return response.data;
  },
  
  /**
   * Обновление задачи
   * @param {string} id - ID задачи
   * @param {Object} taskData - Новые данные задачи
   * @returns {Promise<Object>} Обновленная задача
   */
  updateTask: async (id, taskData) => {
    const response = await axios.put(`/api/publishing/tasks/${id}`, taskData);
    return response.data;
  },
  
  /**
   * Удаление задачи
   * @param {string} id - ID задачи
   * @returns {Promise<Object>} Результат удаления
   */
  deleteTask: async (id) => {
    const response = await axios.delete(`/api/publishing/tasks/${id}`);
    return response.data;
  },
  
  /**
   * Выполнение задачи немедленно
   * @param {string} id - ID задачи
   * @returns {Promise<Object>} Результат выполнения
   */
  executeTask: async (id) => {
    const response = await axios.post(`/api/publishing/tasks/${id}/execute`);
    return response.data;
  },
  
  /**
   * Получение истории публикаций
   * @param {Object} params - Параметры фильтрации и пагинации
   * @returns {Promise<Object>} История публикаций
   */
  getHistory: async (params = {}) => {
    // Изменение на корректный эндпоинт
    const response = await axios.get('/api/publishing/tasks/:taskId/history', { params });
    return response.data;
  },
  
  /**
   * Получение истории публикаций для задачи
   * @param {string} taskId - ID задачи
   * @returns {Promise<Array>} История публикаций для задачи
   */
  getTaskHistory: async (taskId) => {
    const response = await axios.get(`/api/publishing/tasks/${taskId}/history`);
    return response.data;
  },
  
  /**
   * Получение истории публикаций для поста
   * @param {string} postId - ID поста
   * @returns {Promise<Array>} История публикаций для поста
   */
  getPostHistory: async (postId) => {
    const response = await axios.get(`/api/publishing/history/post/${postId}`);
    return response.data;
  },
  
  /**
   * Получение доступных генераторов контента
   * @returns {Promise<Array>} Список генераторов
   */
  getGenerators: async () => {
    const response = await axios.get('/api/publishing/generators');
    return response.data;
  },
  
  /**
   * Публикация существующего поста
   * @param {string} postId - ID поста
   * @param {string} communityId - ID сообщества
   * @param {Object} options - Опции публикации
   * @returns {Promise<Object>} Результат публикации
   */
  publishPost: async (postId, communityId, options = {}) => {
    const response = await axios.post('/api/publishing/publish-post', {
      postId,
      communityId,
      options
    });
    return response.data;
  },
  
  /**
   * Публикация сгенерированного контента
   * @param {string} generatorId - ID генератора
   * @param {Object} params - Параметры для генератора
   * @param {string} communityId - ID сообщества
   * @param {Object} options - Опции публикации
   * @returns {Promise<Object>} Результат публикации
   */
  publishGenerated: async (generatorId, params, communityId, options = {}) => {
    const response = await axios.post('/api/publishing/publish-generated', {
      generatorId,
      params,
      communityId,
      options
    });
    return response.data;
  }
};

export default publishingService;
