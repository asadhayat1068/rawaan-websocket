# Simple WebSocket with Express API

A Node.js application that combines WebSocket server functionality with a RESTful API using Express.js. This allows you to send messages to WebSocket clients via HTTP endpoints.

## Features

- **WebSocket Server**: Real-time bidirectional communication
- **Express API**: RESTful endpoints to interact with WebSocket clients
- **Broadcasting**: Send messages to all connected clients
- **SMS Integration**: Dedicated endpoint for SMS-like messaging
- **Web Client**: Built-in HTML client for testing
- **Health Monitoring**: Status and health check endpoints

## Installation

```bash
npm install
```

## Usage

### Start the Server

```bash
npm start
```

This will start:
- Express HTTP server on `http://localhost:3000`
- WebSocket server on `ws://localhost:8080`

### Test Client

Visit `http://localhost:3000` to access the built-in web client for testing WebSocket functionality.

## API Endpoints

### GET /api
Get API information and available endpoints.

### GET /api/status
Get server status and connected clients count.

```json
{
  "status": "running",
  "connectedClients": 2,
  "timestamp": "2025-10-04T10:30:00.000Z"
}
```

### GET /api/health
Health check endpoint.

```json
{
  "status": "healthy",
  "service": "WebSocket + Express API",
  "timestamp": "2025-10-04T10:30:00.000Z",
  "uptime": 156.789,
  "connectedClients": 2
}
```

### GET /api/clients
Get information about connected WebSocket clients.

```json
{
  "connectedClients": 2,
  "timestamp": "2025-10-04T10:30:00.000Z",
  "message": "2 clients currently connected"
}
```

### POST /api/sms/send
Send an SMS-like message to all connected WebSocket clients.

**Request Body:**
```json
{
  "recipient": "+1234567890",
  "message": "Hello World!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SMS message sent to WebSocket clients",
  "messageSentTo": 2,
  "data": {
    "recipient": "+1234567890",
    "message": "Hello World!",
    "id": "abc123def"
  }
}
```

### POST /api/broadcast
Broadcast a general message to all connected WebSocket clients.

**Request Body:**
```json
{
  "message": "Server maintenance in 5 minutes",
  "type": "notification",
  "data": {"priority": "high"}
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message broadcasted to all WebSocket clients",
  "messageSentTo": 2,
  "broadcastData": {
    "message": "Server maintenance in 5 minutes",
    "type": "notification"
  }
}
```

### POST /api/test
Send a test message to all connected clients (for development).

**Response:**
```json
{
  "success": true,
  "message": "Test message sent",
  "messageSentTo": 2,
  "testMessage": "This is a test message from the API"
}
```

## WebSocket Usage

### Connect to WebSocket
```javascript
const socket = new WebSocket('ws://localhost:8080');

socket.onopen = function(event) {
  console.log('Connected to WebSocket server');
};

socket.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Message Format
WebSocket messages are sent as JSON strings with this structure:

```json
{
  "type": "sms|broadcast|test|notification",
  "message": "The actual message content",
  "recipient": "Optional recipient info",
  "timestamp": "2025-10-04T10:30:00.000Z",
  "id": "unique-message-id",
  "data": {}
}
```

## Integration Example

```javascript
// From another module in your application
const { broadcast, getConnectedClientsCount } = require('./socket');

// Send a message to all WebSocket clients
function notifyClients(message) {
  const clientCount = broadcast(JSON.stringify({
    type: 'notification',
    message: message,
    timestamp: new Date().toISOString()
  }));
  
  console.log(`Message sent to ${clientCount} clients`);
}

// Check if anyone is listening
if (getConnectedClientsCount() > 0) {
  notifyClients('Important update!');
}
```

## Environment Variables

- `PORT`: HTTP server port (default: 3000)
- `WS_PORT`: WebSocket server port (default: 8080)

## File Structure

```
├── index.js           # Main application file
├── socket.js          # WebSocket service module
├── routes.js          # Express API routes
├── example-usage.js   # Usage examples
├── public/
│   └── index.html     # Web-based test client
├── package.json
└── README.md
```

## Development

The application automatically handles:
- WebSocket connection management
- Client disconnect cleanup
- Error handling
- Message broadcasting
- Health monitoring

## Testing

1. Start the server: `npm start`
2. Open `http://localhost:3000` in your browser
3. Click "Connect" to establish WebSocket connection
4. Use the API test buttons to send messages
5. Watch messages appear in real-time

## Dependencies

- `express`: Web framework for HTTP API
- `ws`: WebSocket library for Node.js