const WebSocket = require('ws');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.intervals = new Map();
  }

  /**
   * Initialize the WebSocket server
   * @param {Object} options - Server options
   * @param {string} options.host - Host to bind to (default: '0.0.0.0')
   * @param {number} options.port - Port to listen on (default: 8080)
   */
  initialize(options = {}) {
    const { host = '0.0.0.0', port = 8080 } = options;

    if (this.wss) {
      console.log('WebSocket server is already initialized');
      return;
    }

    // Create WebSocket server
    this.wss = new WebSocket.Server({ host, port });

    // Handle new connections
    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      
      // Add client to our set
      this.clients.add(ws);

      // Send welcome message
      ws.send('Welcome! You are connected to the WebSocket server.');

      // Start periodic messages for this client
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('Server message: ' + new Date().toISOString());
        }
      }, 12_000);
      
      this.intervals.set(ws, interval);

      // Handle client disconnection
      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
        
        // Clean up interval
        const clientInterval = this.intervals.get(ws);
        if (clientInterval) {
          clearInterval(clientInterval);
          this.intervals.delete(ws);
        }
      });

      // Handle client errors
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        this.clients.delete(ws);
        
        // Clean up interval
        const clientInterval = this.intervals.get(ws);
        if (clientInterval) {
          clearInterval(clientInterval);
          this.intervals.delete(ws);
        }
      });
    });

    console.log(`WebSocket server running on ws://${host}:${port}`);
  }

  /**
   * Send a message to all connected clients
   * @param {string} message - Message to send
   * @returns {number} Number of clients the message was sent to
   */
  broadcast(message) {
    if (!this.wss) {
      console.error('WebSocket server not initialized');
      return 0;
    }

    let sentCount = 0;
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sentCount++;
      }
    });

    return sentCount;
  }

  /**
   * Send a message to a specific client
   * @param {WebSocket} client - The client WebSocket to send to
   * @param {string} message - Message to send
   * @returns {boolean} True if message was sent, false otherwise
   */
  sendToClient(client, message) {
    if (!this.clients.has(client)) {
      console.error('Client not found in connected clients');
      return false;
    }

    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      return true;
    }
    
    return false;
  }

  /**
   * Get the number of connected clients
   * @returns {number} Number of connected clients
   */
  getConnectedClientsCount() {
    return this.clients.size;
  }

  /**
   * Get all connected clients
   * @returns {Set<WebSocket>} Set of connected WebSocket clients
   */
  getConnectedClients() {
    return new Set(this.clients);
  }

  /**
   * Close the WebSocket server and all connections
   */
  close() {
    if (!this.wss) {
      console.log('WebSocket server is not running');
      return;
    }

    // Clear all intervals
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.intervals.clear();

    // Close all client connections
    this.clients.forEach((ws) => {
      ws.close();
    });
    this.clients.clear();

    // Close the server
    this.wss.close(() => {
      console.log('WebSocket server closed');
    });
    
    this.wss = null;
  }
}

// Create a singleton instance
const webSocketService = new WebSocketService();

module.exports = {
  webSocketService,
  // Export convenience functions
  initialize: (options) => webSocketService.initialize(options),
  broadcast: (message) => webSocketService.broadcast(message),
  sendToClient: (client, message) => webSocketService.sendToClient(client, message),
  getConnectedClientsCount: () => webSocketService.getConnectedClientsCount(),
  getConnectedClients: () => webSocketService.getConnectedClients(),
  close: () => webSocketService.close()
};

