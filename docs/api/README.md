# API Documentation

This directory contains documentation for the Community Manager API.

## Available Endpoints

### Publishing Module

- [Publishing Routes](/docs/api/publishing-routes.md) - `/api/publishing/` endpoints for managing content publication
- [Publish Tasks Routes](/docs/api/publish-tasks-routes.md) - `/api/publish-tasks/` endpoints for scheduled publication tasks

## Common Response Formats

Most API endpoints follow these common response patterns:

### List Endpoints

List endpoints provide paginated results with this format:

```json
{
  "data": [ ... ],  // Array of items
  "pagination": {
    "total": 100,   // Total number of items
    "page": 1,      // Current page
    "limit": 20,    // Items per page
    "pages": 5      // Total number of pages
  }
}
```

### Error Responses

Error responses generally follow this format:

```json
{
  "error": "Error message"
}
```

or for more detailed errors:

```json
{
  "status": "error",
  "error": "Error message",
  "details": "Additional error details"
}
```

## Authentication

Most API endpoints require authentication. Authentication details are not covered in this documentation.
