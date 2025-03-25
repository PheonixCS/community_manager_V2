# API Репозитории

## Введение

Репозитории предоставляют единый интерфейс для работы с моделями базы данных. Они инкапсулируют логику доступа к данным и обеспечивают более чистую архитектуру приложения, отделяя бизнес-логику от деталей хранения данных.

## Базовый репозиторий

`BaseRepository` предоставляет основные CRUD операции, которые наследуются специализированными репозиториями.

### Методы

- `create(data)` - Создает новую запись
- `findById(id)` - Находит запись по ID
- `findAll(filter, options)` - Находит все записи с применением фильтров, сортировки и пагинации
- `update(id, data, options)` - Обновляет запись по ID
- `delete(id)` - Удаляет запись по ID
- `aggregate(pipeline)` - Выполняет произвольный запрос с агрегацией
- `count(filter)` - Подсчитывает количество документов

## PostRepository

Репозиторий для работы с постами (модель `Post`).

### Специальные методы

- `getTopRatedPosts(filter, options)` - Получает топ постов по рейтингу
- `getStatistics()` - Получает статистику по постам
- `findByCommunity(communityId, options)` - Находит посты для конкретного сообщества
- `deleteAll()` - Удаляет все посты и обновляет статистику заданий
- `updateAllViewRates()` - Обновляет рейтинг для всех постов

## FilterTemplateRepository

Репозиторий для работы с шаблонами фильтров (модель `FilterTemplate`).

### Специальные методы

- `createTemplate(data)` - Создает новый шаблон фильтра с обработкой полей mediaFilters
- `updateTemplate(id, data)` - Обновляет шаблон фильтра с обработкой полей mediaFilters
- `findByName(name)` - Находит шаблоны по частичному совпадению имени

## TaskRepository

Репозиторий для работы с задачами скрапинга (модель `ScrapingTask`).

### Специальные методы

- `findActiveTasks()` - Находит активные задачи, которые должны быть запущены
- `updateTaskStatistics(id, stats)` - Обновляет статистику задачи после выполнения
- `executeTaskNow(id)` - Выполняет задачу немедленно и обновляет ее расписание
- `toggleTaskActive(id)` - Переключает активность задачи
- `resetStatistics(taskIds)` - Сбрасывает статистику для списка задач

## Примеры использования

### Получение постов с пагинацией

```javascript
const { postRepository } = require('../repositories');

async function getPaginatedPosts(page, limit) {
  const skip = (page - 1) * limit;
  return await postRepository.findAll({}, { 
    limit, 
    skip, 
    sort: { date: -1 } 
  });
}
```

### Обновление статистики задачи

```javascript
const { taskRepository } = require('../repositories');

async function updateTaskStats(taskId, newPostsCount, updatedPostsCount) {
  return await taskRepository.updateTaskStatistics(taskId, {
    newPostsCount,
    updatedPostsCount
  });
}
```
