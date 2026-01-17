# Homepage Sections API Documentation

## Overview
This API manages dynamic homepage banner/card sections that can be configured by admin and displayed on the mobile homepage.

## Database Schema

### Table: `homepage_sections`
- `id` (INT, PK, AUTO_INCREMENT)
- `title` (VARCHAR, nullable)
- `image` (TEXT) - Image URL
- `link` (TEXT, nullable) - Fallback link
- `routeTo` (VARCHAR, nullable) - Frontend route name (e.g., `/shop`)
- `filters` (JSON, nullable) - Shop filters object
- `position` (INT) - Order on homepage
- `isActive` (BOOLEAN, default true)
- `createdAt` (DATETIME)
- `updatedAt` (DATETIME)

## API Endpoints

### 1. Create Section (Admin)
**POST** `/api/homepage-sections`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Top Deals",
  "image": "https://cdn.example.com/banner.png",
  "link": "/shop",
  "routeTo": "/shop",
  "filters": {
    "type": "customproduct",
    "categoryID": "CAT123",
    "offerID": "OFFER456",
    "minPrice": 100,
    "maxPrice": 500,
    "sortBy": "price_low_to_high"
  },
  "position": 1,
  "isActive": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Section created successfully",
  "data": {
    "id": 1,
    "title": "Top Deals",
    "image": "https://cdn.example.com/banner.png",
    "link": "/shop",
    "routeTo": "/shop",
    "filters": {
      "type": "customproduct",
      "categoryID": "CAT123",
      "offerID": "OFFER456",
      "minPrice": 100,
      "maxPrice": 500,
      "sortBy": "price_low_to_high"
    },
    "position": 1,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Image is required"
}
```

---

### 2. List All Sections (Admin)
**GET** `/api/homepage-sections`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10) - Items per page
- `sortBy` (optional, default: 'position') - Sort field: `id`, `position`, `createdAt`, `updatedAt`, `title`
- `sortDir` (optional, default: 'ASC') - Sort direction: `ASC` or `DESC`

**Example:**
```
GET /api/homepage-sections?page=1&limit=10&sortBy=position&sortDir=ASC
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sections retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Top Deals",
      "image": "https://cdn.example.com/banner.png",
      "link": "/shop",
      "routeTo": "/shop",
      "filters": {
        "type": "customproduct",
        "categoryID": "CAT123"
      },
      "position": 1,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "title": "New Arrivals",
      "image": "https://cdn.example.com/banner2.png",
      "link": "/shop",
      "routeTo": "/shop",
      "filters": {
        "type": "customproduct",
        "sortBy": "newest"
      },
      "position": 2,
      "isActive": true,
      "createdAt": "2024-01-15T11:00:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalItems": 2,
    "totalPages": 1,
    "limit": 10
  }
}
```

---

### 3. Get Active Sections (Frontend - Public)
**GET** `/api/homepage-sections/active`

**Headers:** None required (Public endpoint)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Active sections retrieved successfully",
  "data": [
    {
      "id": 1,
      "title": "Top Deals",
      "image": "https://cdn.example.com/banner.png",
      "link": "/shop",
      "routeTo": "/shop",
      "filters": {
        "type": "customproduct",
        "categoryID": "CAT123",
        "offerID": "OFFER456",
        "minPrice": 100,
        "maxPrice": 500,
        "sortBy": "price_low_to_high"
      },
      "position": 1,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Note:** Only returns sections where `isActive = true`, sorted by `position ASC`.

---

### 4. Get Section by ID
**GET** `/api/homepage-sections/:id`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Section retrieved successfully",
  "data": {
    "id": 1,
    "title": "Top Deals",
    "image": "https://cdn.example.com/banner.png",
    "link": "/shop",
    "routeTo": "/shop",
    "filters": {
      "type": "customproduct",
      "categoryID": "CAT123"
    },
    "position": 1,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Section not found"
}
```

---

### 5. Update Section (Admin)
**PUT** `/api/homepage-sections/:id`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body (all fields optional):**
```json
{
  "title": "Updated Title",
  "image": "https://cdn.example.com/new-banner.png",
  "link": "/shop",
  "routeTo": "/shop",
  "filters": {
    "type": "customproduct",
    "categoryID": "CAT456"
  },
  "position": 2,
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Section updated successfully",
  "data": {
    "id": 1,
    "title": "Updated Title",
    "image": "https://cdn.example.com/new-banner.png",
    "link": "/shop",
    "routeTo": "/shop",
    "filters": {
      "type": "customproduct",
      "categoryID": "CAT456"
    },
    "position": 2,
    "isActive": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

---

### 6. Delete Section (Admin)
**DELETE** `/api/homepage-sections/:id`

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Section deleted successfully"
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Section not found"
}
```

---

### 7. Enable / Disable Section (Admin)
**PATCH** `/api/homepage-sections/:id/status`

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Section disabled successfully",
  "data": {
    "id": 1,
    "title": "Top Deals",
    "image": "https://cdn.example.com/banner.png",
    "link": "/shop",
    "routeTo": "/shop",
    "filters": {
      "type": "customproduct",
      "categoryID": "CAT123"
    },
    "position": 1,
    "isActive": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T12:30:00.000Z"
  }
}
```

---

## Filters Object Structure

The `filters` JSON object supports all shop endpoint filters:

```json
{
  "type": "customproduct" | "combo" | "presale",
  "categoryID": "CAT123",
  "offerID": "OFFER456",
  "minPrice": 100,
  "maxPrice": 500,
  "sortBy": "price_low_to_high" | "price_high_to_low" | "newest" | "popular",
  "brandID": "BRAND123",
  "search": "keyword"
}
```

**Note:** All filter fields are optional. Only include the filters you want to apply.

---

## Frontend Usage Example

### React/Flutter Example

```javascript
// Fetch active sections on homepage load
const fetchHomepageSections = async () => {
  try {
    const response = await fetch('https://api.example.com/api/homepage-sections/active');
    const result = await response.json();
    
    if (result.success) {
      return result.data; // Array of sections
    }
  } catch (error) {
    console.error('Error fetching homepage sections:', error);
  }
};

// Render sections
const Homepage = () => {
  const [sections, setSections] = useState([]);
  
  useEffect(() => {
    fetchHomepageSections().then(setSections);
  }, []);
  
  return (
    <View>
      {sections.map((section) => (
        <TouchableOpacity
          key={section.id}
          onPress={() => {
            // Navigate to shop page with filters
            navigation.navigate(section.routeTo, {
              filters: section.filters
            });
          }}
        >
          <Image source={{ uri: section.image }} />
          {section.title && <Text>{section.title}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error information (optional)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `500` - Internal Server Error

---

## Notes

1. **Authentication:** All admin endpoints require Bearer token in Authorization header
2. **Public Endpoint:** `/api/homepage-sections/active` is public and doesn't require authentication
3. **Position:** If not provided during creation, position is auto-calculated (max position + 1)
4. **Filters:** Must be a valid JSON object. Can be `null` if no filters needed
5. **Image:** Required field. Should be a valid URL
6. **isActive:** Defaults to `true` if not provided
