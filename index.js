const express = require('express');
const { initialize, getConnectedClientsCount } = require('./socket');
const apiRoutes = require('./routes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize WebSocket server on application startup
console.log('Starting application...');

// Initialize WebSocket server with default settings
initialize({
  host: '0.0.0.0',
  port: WS_PORT
});

// Root route
app.get('/api', (req, res) => {
  res.json({
    message: 'WebSocket server with Express is running',
    websocket: `ws://localhost:${WS_PORT}`,
    httpServer: `http://localhost:${PORT}`,
    connectedClients: getConnectedClientsCount(),
    endpoints: {
      status: '/api/status',
      health: '/api/health',
      clients: '/api/clients',
      sendSMS: '/api/sms/send',
      broadcast: '/api/broadcast',
      test: '/api/test'
    },
    documentation: {
      websocket: 'Connect to WebSocket server to receive real-time messages',
      api: 'Use HTTP endpoints to send messages through WebSocket to connected clients',
      testClient: 'Visit / for a web-based test client'
    }
  });
});

// Use API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: {
      root: '/',
      api: '/api',
      status: '/api/status',
      health: '/api/health',
      clients: '/api/clients',
      sendSMS: '/api/sms/send',
      broadcast: '/api/broadcast',
      test: '/api/test'
    }
  });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${WS_PORT}`);
  console.log('Available endpoints:');
  console.log(`  GET  /                    - API information`);
  console.log(`  GET  /api/status          - Server status`);
  console.log(`  GET  /api/health          - Health check`);
  console.log(`  GET  /api/clients         - Connected clients info`);
  console.log(`  POST /api/sms/send        - Send SMS via WebSocket`);
  console.log(`  POST /api/broadcast       - Broadcast message`);
  console.log(`  POST /api/test            - Send test message`);
});

console.log('Application started successfully');

