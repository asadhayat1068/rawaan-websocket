# Inter-Container Communication Guide

This guide explains how to send HTTP requests to the WebSocket API from other Docker containers on the same network.

## Quick Answer

Use the service name `websocket-app` as the hostname:

```bash
# Base URL format:
http://websocket-app:3000/api/sms/send
```

## Network Configuration

Your containers must be on the same Docker network (`fleetbase` in your case).

### Your Current Network Setup

```yaml
# In docker-compose.yml
networks:
  fleetbase:
    driver: bridge
    name: fleetbase
```

## Making HTTP Requests

### 1. Using cURL from Alpine Container

```bash
# Run a one-time container to test the API
docker run --rm --network fleetbase alpine/curl \
  curl -X POST http://websocket-app:3000/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{"recipient": "+1234567890", "message": "Hello from Docker!"}'
```

### 2. Adding a Client Service to docker-compose.yml

```yaml
services:
  websocket-app:
    # ... your existing service

  api-client:
    image: alpine/curl
    networks:
      - fleetbase
    depends_on:
      - websocket-app
    command: >
      sh -c "
        sleep 5
        curl -X POST http://websocket-app:3000/api/sms/send \
          -H 'Content-Type: application/json' \
          -d '{\"recipient\": \"+1234567890\", \"message\": \"Hello from Docker!\"}' \
          -v
      "
```

### 3. Node.js Application Making Requests

```javascript
const axios = require('axios');

// Use service name as hostname
const API_BASE_URL = 'http://websocket-app:3000/api';

async function sendSMS(recipient, message) {
  try {
    const response = await axios.post(`${API_BASE_URL}/sms/send`, {
      recipient,
      message
    });
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data);
    throw error;
  }
}

// Usage
sendSMS('+1234567890', 'Hello from Node.js container!');
```

### 4. Python Application Making Requests

```python
import requests
import json

# Use service name as hostname
API_BASE_URL = 'http://websocket-app:3000/api'

def send_sms(recipient, message):
    url = f'{API_BASE_URL}/sms/send'
    payload = {
        'recipient': recipient,
        'message': message
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage
result = send_sms('+1234567890', 'Hello from Python container!')
print(result)
```

## Available Endpoints

All endpoints are relative to `http://websocket-app:3000/api`:

- `GET /status` - Server status
- `GET /health` - Health check
- `GET /clients` - Connected clients info
- `POST /sms/send` - Send SMS message
- `POST /broadcast` - Broadcast message
- `POST /test` - Send test message

## Example Requests

### Send SMS Message

```bash
curl -X POST http://websocket-app:3000/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "+1234567890",
    "message": "Your order has been confirmed!"
  }'
```

### Broadcast Message

```bash
curl -X POST http://websocket-app:3000/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "message": "System maintenance in 5 minutes",
    "type": "system-alert"
  }'
```

### Check Status

```bash
curl http://websocket-app:3000/api/status
```

## Testing Your Setup

### 1. Start Your Services

```bash
docker-compose up -d
```

### 2. Test from External Container

```bash
# Quick test using curl container
docker run --rm --network fleetbase alpine/curl \
  curl -v http://websocket-app:3000/api/health
```

### 3. Test All Endpoints

```bash
# Use the provided test script
docker run --rm --network fleetbase -v $(pwd)/client-examples:/scripts alpine/curl \
  sh /scripts/test-api.sh
```

### 4. Test with Node.js Client

```bash
# Start the Node.js client example
docker-compose -f docker-compose.example.yml up node-client
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure both containers are on the same network
   - Check if the websocket-app service is running: `docker-compose ps`
   - Verify the service name is correct: `websocket-app`

2. **DNS Resolution Failed**
   - Make sure you're using the correct service name
   - Check network configuration in docker-compose.yml
   - Ensure containers are on the same network

3. **Port Issues**
   - Use port 3000 (internal port), not the mapped external port
   - Don't use localhost or 127.0.0.1, use the service name

### Debug Commands

```bash
# Check if services are running
docker-compose ps

# Check network connectivity
docker run --rm --network fleetbase alpine/curl \
  ping websocket-app

# Check if port is open
docker run --rm --network fleetbase alpine/curl \
  telnet websocket-app 3000

# View logs
docker-compose logs websocket-app
```

## Integration Examples

### In Your Own Application

If you have your own application that needs to send messages:

```yaml
# Add to your docker-compose.yml
services:
  your-app:
    build: .
    networks:
      - fleetbase  # Same network as websocket-app
    environment:
      - WEBSOCKET_API_URL=http://websocket-app:3000/api
```

Then in your application code, use the environment variable:

```javascript
const API_URL = process.env.WEBSOCKET_API_URL || 'http://websocket-app:3000/api';

// Send notification when user registers
await axios.post(`${API_URL}/sms/send`, {
  recipient: user.phone,
  message: 'Welcome to our service!'
});
```

## Security Considerations

1. **Internal Network Only**: These requests work only within the Docker network
2. **No Authentication**: Add authentication if needed for production
3. **Rate Limiting**: Consider adding rate limiting for production use
4. **Input Validation**: Always validate input data before sending requests