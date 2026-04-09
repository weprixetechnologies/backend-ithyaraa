# Home Category Tiles API Documentation

## Overview
This API manages the category tiles displayed on the homepage. Each tile links to a category and features a specific curated image.

## Database Schema

### Table: `home_categories`
- `id` (INT, PK, AUTO_INCREMENT)
- `categoryID` (INT, Unique) - Foreign key to `categories.categoryID`
- `imageUrl` (TEXT) - Custom image to display on the homepage
- `sortOrder` (INT, nullable) - Display priority
- `createdAt` (DATETIME)
- `updatedAt` (DATETIME)

---

## Public API Endpoints

### 1. List Home Category Tiles
**GET** `/api/home-categories`

**Description:**
Returns all active homepage category tiles with their display names and images. Used by the storefront to render the "Shop by Category" or "Category Grid" section.

**Headers:** None required.

**Example Response (200 OK):**
```json
[
  {
    "categoryID": 1,
    "imageUrl": "https://cdn.ithyaraa.com/categories/mens-wear-home.jpg",
    "categoryName": "Men's Wear"
  },
  {
    "categoryID": 2,
    "imageUrl": "https://cdn.ithyaraa.com/categories/womens-wear-home.jpg",
    "categoryName": "Women's Wear"
  }
]
```

---

## Admin API Endpoints

### 2. List All Tiles (Admin)
**GET** `/api/admin/home-categories`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Description:**
Same as the public endpoint but secured for admin access.

---

### 3. Upsert Category Tile (Admin)
**POST** `/api/admin/home-categories`

**Description:**
Creates or updates (upserts) a home category tile mapping. If the `categoryID` already exists in the `home_categories` table, its image and sort order will be updated.

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "categoryID": 1,
  "imageUrl": "https://cdn.ithyaraa.com/categories/new-image.jpg",
  "sortOrder": 5
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Home category tile saved successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "categoryID and imageUrl are required"
}
```

---

## Error Handling

All endpoints follow a standard error response format:

```json
{
  "success": false,
  "message": "Error description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing required fields or invalid categoryID)
- `401` - Unauthorized (missing or invalid admin token)
- `500` - Internal Server Error
