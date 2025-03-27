# Publishing API Documentation

This document describes the API endpoints for the publishing module available at `/api/publishing/`.

## Tasks

### Get Publishing Tasks

Retrieves a list of publishing tasks with pagination.

- **URL**: `/api/publishing/tasks`
- **Method**: `GET`
- **Query Parameters**:
  - `type` (optional): Filter by task type
  - `active` (optional): Filter by active status (`true` or `false`)
  - `limit` (optional): Number of results per page (default: 20)
  - `page` (optional): Page number (default: 1)
- **Response**: 
  ```json
  {
    "data": [
      {
        "_id": "task_id",
        "type": "task_type",
        "schedule": { "active": true, ... },
        "scrapingTasks": [ ... ],
        "createdAt": "date"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "pages": 5
    }
  }
  ```

### Get Publishing Task by ID

Retrieves a specific publishing task by its ID.

- **URL**: `/api/publishing/tasks/:id`
- **Method**: `GET`
- **URL Parameters**:
  - `id`: ID of the task to retrieve
- **Response**: 
  ```json
  {
    "_id": "task_id",
    "type": "task_type",
    "schedule": { "active": true, ... },
    "scrapingTasks": [ ... ],
    "createdAt": "date"
  }
  ```
- **Error Response**: 
  - Status: 404 - `{ "error": "Publish task not found" }`

### Create Publishing Task

Creates a new publishing task.

- **URL**: `/api/publishing/tasks`
- **Method**: `POST`
- **Request Body**: Task data object
  ```json
  {
    "type": "task_type",
    "schedule": {
      "active": true,
      "frequency": "daily",
      "time": "12:00"
    },
    "scrapingTasks": ["scraping_task_id1", "scraping_task_id2"],
    "targetGroupId": "-123456789"
  }
  ```
- **Response**: 
  - Status: 201 - The created task object
- **Error Response**:
  - Status: 400 - `{ "error": "error message" }`

### Update Publishing Task

Updates an existing publishing task.

- **URL**: `/api/publishing/tasks/:id`
- **Method**: `PUT`
- **URL Parameters**:
  - `id`: ID of the task to update
- **Request Body**: Updated task data
  ```json
  {
    "type": "updated_type",
    "schedule": {
      "active": false
    }
  }
  ```
- **Response**: The updated task object
- **Error Response**:
  - Status: 404 - `{ "error": "Publish task not found" }`
  - Status: 400 - `{ "error": "error message" }`

### Delete Publishing Task

Deletes a publishing task.

- **URL**: `/api/publishing/tasks/:id`
- **Method**: `DELETE`
- **URL Parameters**:
  - `id`: ID of the task to delete
- **Response**:
  ```json
  { "message": "Publish task deleted successfully" }
  ```
- **Error Response**:
  - Status: 404 - `{ "error": "Publish task not found" }`

### Execute Publishing Task

Immediately executes a publishing task.

- **URL**: `/api/publishing/tasks/:id/execute`
- **Method**: `POST`
- **URL Parameters**:
  - `id`: ID of the task to execute
- **Response**:
  ```json
  {
    "message": "Task executed successfully with X successful and Y failed publications",
    "result": {
      "successful": 5,
      "failed": 1,
      "details": [ ... ]
    }
  }
  ```
- **Error Response**:
  - Status: 500 - `{ "error": "error message" }`

### Get Task Publishing History

Retrieves the publishing history for a specific task.

- **URL**: `/api/publishing/tasks/:id/history`
- **Method**: `GET`
- **URL Parameters**:
  - `id`: ID of the task
- **Response**:
  ```json
  {
    "data": [
      {
        "_id": "history_id",
        "publishTaskId": "task_id",
        "postId": "post_id",
        "targetGroupId": "-123456789",
        "publishedAt": "date",
        "status": "success"
      }
    ],
    "pagination": {
      "total": 10,
      "page": 1,
      "limit": 10,
      "pages": 1
    }
  }
  ```

## Post Publishing

### Get Post Publishing History

Retrieves the publishing history for a specific post.

- **URL**: `/api/publishing/history/post/:postId`
- **Method**: `GET`
- **URL Parameters**:
  - `postId`: ID of the post
- **Response**:
  ```json
  {
    "data": [
      {
        "_id": "history_id",
        "publishTaskId": "task_id",
        "postId": "post_id",
        "targetGroupId": "-123456789",
        "publishedAt": "date",
        "status": "success"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 5,
      "pages": 1
    }
  }
  ```

### Publish Existing Post

Publishes an existing post to a VK community.

- **URL**: `/api/publishing/publish-post`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "postId": "post_id",
    "communityId": "-123456789",
    "options": {
      "withComments": true,
      "publishDate": "2023-10-20T12:00:00Z"
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "postId": "vk_post_id",
    "vkUrl": "https://vk.com/wall-123456789_123"
  }
  ```
- **Error Response**:
  - Status: 400 - `{ "status": "error", "error": "error message", "details": "error details" }`

### Publish Generated Content

Generates and publishes content using a content generator.

- **URL**: `/api/publishing/publish-generated`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "generatorId": "generator_id",
    "params": { 
      "topic": "Interesting topic",
      "length": "medium"
    },
    "communityId": "-123456789",
    "options": {
      "publishDate": "2023-10-20T12:00:00Z"
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "success",
    "postId": "vk_post_id",
    "vkUrl": "https://vk.com/wall-123456789_123"
  }
  ```
- **Error Response**:
  - Status: 400 - `{ "status": "error", "error": "error message" }`

## Content Generation

### Get Available Content Generators

Retrieves a list of available content generators.

- **URL**: `/api/publishing/generators`
- **Method**: `GET`
- **Response**: Array of generator objects
  ```json
  [
    {
      "id": "generator_id",
      "name": "Generator Name",
      "description": "Generator description",
      "parameters": [
        {
          "name": "topic",
          "type": "string",
          "required": true
        }
      ]
    }
  ]
  ```

## History

### Get Publishing History

Retrieves publishing history with filtering options.

- **URL**: `/api/publishing/history`
- **Method**: `GET`
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Items per page (default: 20)
  - `status` (optional): Filter by status (success/error)
  - `dateFrom` (optional): Filter from date
  - `dateTo` (optional): Filter to date
  - `targetGroupId` (optional): Filter by target group ID
  - `taskId` (optional): Filter by task ID (use "manual" for manual publications)
- **Response**:
  ```json
  {
    "data": [
      {
        "_id": "history_id",
        "publishTaskId": "task_id",
        "postId": "post_id",
        "sourceGroupId": "-123456",
        "targetGroupId": "-789012",
        "publishedAt": "date",
        "status": "success"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "pages": 5
    }
  }
  ```
