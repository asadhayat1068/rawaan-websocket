const express = require('express');
const { broadcast, getConnectedClientsCount, getConnectedClients, getGatewayCount } = require('./socket');

const router = express.Router();

// Status endpoint
router.get('/status', (req, res) => {
    res.json({
        status: 'running',
        connectedClients: getConnectedClientsCount(),
        authenticatedGateways: getGatewayCount(),
        timestamp: new Date().toISOString(),
        server: 'WebSocket + Express API'
    });
});

// SMS send endpoint
router.post('/sms/send', (req, res) => {
    console.log("Request Body: ", req.body);
    const { recipient, message } = req.body;

    if (!message) {
        return res.status(400).json({
            error: 'Message is required',
            example: { recipient: '+1234567890', message: 'Hello World' }
        });
    }

    // Create structured SMS message
    const smsMessage = JSON.stringify({
        type: 'sms',
        recipient,
        message,
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9)
    });

    const clientCount = broadcast(smsMessage);

    res.json({
        success: true,
        message: 'SMS message sent request submitted to WebSocket clients',
        messageSentTo: clientCount,
        data: {
            recipient: recipient || 'broadcast',
            message,
            id: smsMessage.id
        }
    });
});

// General broadcast endpoint
router.post('/broadcast', (req, res) => {
    const { message, type, data } = req.body;

    if (!message) {
        return res.status(400).json({
            error: 'Message is required',
            example: { message: 'Hello everyone!', type: 'notification' }
        });
    }

    const broadcastMessage = JSON.stringify({
        type: type || 'broadcast',
        message,
        data: data || {},
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9)
    });

    const clientCount = broadcast(broadcastMessage);

    res.json({
        success: true,
        message: 'Message broadcasted to all WebSocket clients',
        messageSentTo: clientCount,
        broadcastData: { message, type: type || 'broadcast' }
    });
});

// WebSocket clients info endpoint
router.get('/clients', (req, res) => {
    const clientCount = getConnectedClientsCount();
    res.json({
        connectedClients: clientCount,
        timestamp: new Date().toISOString(),
        message: clientCount > 0 ?
            `${clientCount} client${clientCount > 1 ? 's' : ''} currently connected` :
            'No clients connected'
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'WebSocket + Express API',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connectedClients: getConnectedClientsCount()
    });
});

// Test message endpoint for development
router.post('/test', (req, res) => {
    const testMessage = JSON.stringify({
        type: 'test',
        message: 'This is a test message from the API',
        timestamp: new Date().toISOString(),
        source: 'REST API'
    });

    const clientCount = broadcast(testMessage);

    res.json({
        success: true,
        message: 'Test message sent',
        messageSentTo: clientCount,
        testMessage: 'This is a test message from the API'
    });
});

module.exports = router;