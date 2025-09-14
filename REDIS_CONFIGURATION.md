# Redis Configuration with TLS Support

This project now supports Redis connections with TLS encryption using the `REDIS_URL` environment variable.

## Environment Variable Setup

Add the following environment variable to your `.env` file:

```bash
# For local development without TLS
REDIS_URL=redis://127.0.0.1:6379

# For production with TLS (replace with your actual Redis URL)
REDIS_URL=rediss://username:password@your-redis-host:6380
```

## URL Format

The `REDIS_URL` supports both secure and non-secure connections:

- **Non-secure**: `redis://[username:password@]host:port`
- **Secure (TLS)**: `rediss://[username:password@]host:port`

## Features

- **Automatic TLS Detection**: The system automatically detects if the URL uses `rediss://` and enables TLS
- **Fallback Configuration**: If `REDIS_URL` is not provided, it falls back to `redis://127.0.0.1:6379`
- **Error Handling**: Invalid URL formats are caught and logged with fallback to default configuration
- **TLS Configuration**: For secure connections, TLS is configured with `rejectUnauthorized: false` (set to `true` in production with proper certificates)

## Files Updated

The following files now use the centralized Redis configuration:

- `utils/config.js` - Central configuration with Redis URL parsing
- `queue/emailProducer.js` - Email queue producer
- `queue/producer.js` - General notification queue producer
- `queue/worker/emailWorker.js` - Email queue worker
- `queue/worker/worker.js` - General notification queue worker

## Usage

All Redis connections in the application now automatically use the `REDIS_CONFIG` from the config file, which includes:

- Host and port from the URL
- Username and password authentication (if provided)
- TLS configuration for secure connections
- Proper error handling and fallbacks

## Production Notes

For production environments:

1. Set `rejectUnauthorized: true` in the TLS configuration for better security
2. Use proper SSL certificates
3. Ensure your Redis server supports TLS connections
4. Use strong passwords and consider using Redis AUTH

## Example URLs

```bash
# Local development
REDIS_URL=redis://127.0.0.1:6379

# Production with authentication
REDIS_URL=rediss://myuser:mypassword@redis.example.com:6380

# Production with authentication and custom port
REDIS_URL=rediss://myuser:mypassword@redis.example.com:6380
```
