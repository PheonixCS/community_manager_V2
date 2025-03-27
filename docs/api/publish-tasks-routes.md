# Publish Tasks API Documentation

This document describes the API endpoints for the publish tasks module available at `/api/publish-tasks/`.

## Tasks

### Get Publish Tasks

Retrieves a list of publish tasks with pagination.

- **URL**: `/api/publish-tasks`
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

### Get Publish Task by ID

Retrieves a specific publish task by its ID.

- **URL**: `/api/publish-tasks/:id`
- **Method**: `GET`
- **URL Parameters**:
  - `id`: ID of the task to retrieve
- **Response**: Task object
  ```json
  {
    "_id": "task_id",
    "type": "task_type",
    "schedule": { "active": true, ... },
    "createdAt": "date"
  }
  ```
- **Error Response**: 
  - Status: 404 - `{ "error": "Publish task not found" }`

### Create Publish Task

Creates a new publish task.

- **URL**: `/api/publish-tasks`
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
    "targetGroupId": "-123456789"
  }
  ```
- **Response**: 
  - Status: 201 - The created task object
- **Error Response**:
  - Status: 400 - `{ "error": "error message" }`

### Update Publish Task

Updates an existing publish task.

- **URL**: `/api/publish-tasks/:id`
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

### Delete Publish Task

Deletes a publish task.

- **URL**: `/api/publish-tasks/:id`
- **Method**: `DELETE`
- **URL Parameters**:
  - `id`: ID of the task to delete
- **Response**:
  ```json
  { "message": "Publish task deleted successfully" }
  ```
- **Error Response**:
  - Status: 404 - `{ "error": "Publish task not found" }`

### Execute Publish Task

Immediately executes a publish task.

- **URL**: `/api/publish-tasks/:id/execute`
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

### Add Posts to Publish Task

Adds multiple posts to an existing publish task.

- **URL**: `/api/publish-tasks/:id/add-posts`
- **Method**: `POST`
- **URL Parameters**:
  - `id`: ID of the task 
- **Request Body**:
  ```json
  {
    "postIds": ["post_id1", "post_id2", "post_id3"]
  }
  ```
- **Response**:
  ```json
  {
    "message": "Added 3 posts to the task",
    "task": {
      "_id": "task_id",
      "posts": ["post_id1", "post_id2", "post_id3"],
      "schedule": { ... }
    }
  }
  ```
- **Error Response**:
  - Status: 400 - `{ "error": "Post IDs array is required" }`
  - Status: 404 - `{ "error": "Publish task not found" }`

## History

### Get Task Publishing History

Retrieves the publishing history for a specific task.

- **URL**: `/api/publish-tasks/:id/history`
- **Method**: `GET`
- **URL Parameters**:
  - `id`: ID of the task
- **Response**: Array of history objects
  ```json
  [
    {
      "_id": "history_id",
      "publishTaskId": "task_id",
      "postId": "post_id",
      "targetGroupId": "-123456789",
      "publishedAt": "date",
      "status": "success"
    }
  ]
  ```

### Get Post Publishing History

Retrieves the publishing history for a specific post.

- **URL**: `/api/publish-tasks/history/post/:postId`
- **Method**: `GET`
- **URL Parameters**:
  - `postId`: ID of the post
- **Response**: Array of history objects
  ```json
  [
    {
      "_id": "history_id",
      "publishTaskId": "task_id",
      "postId": "post_id",
      "targetGroupId": "-123456789",
      "publishedAt": "date",
      "status": "success"
    }
  ]
  ```
