const crypto = require('crypto');
const WebSocket = require('ws');
const { forwardInboundSms, maskPhone } = require('./inbound');

// Gateways authenticate with GATEWAY_TOKEN, and only authenticated gateways can submit received SMS.
// Until GATEWAY_AUTH_REQUIRED is true, unauthenticated clients still receive SMS jobs (legacy behaviour),
// so the token can be set and the gateway updated before older clients are cut off.
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || null;
const GATEWAY_AUTH_REQUIRED = Boolean(GATEWAY_TOKEN) && ['1', 'true'].includes(String(process.env.GATEWAY_AUTH_REQUIRED).toLowerCase());
const AUTH_TIMEOUT_MS = 5_000;

/**
 * Compare a presented token with the gateway token in constant time
 * @param {string|null|undefined} token
 * @returns {boolean}
 */
function isValidGatewayToken(token) {
  if (!GATEWAY_TOKEN || typeof token !== 'string') {
    return false;
  }

  const expected = Buffer.from(GATEWAY_TOKEN);
  const presented = Buffer.from(token);
  return expected.length === presented.length && crypto.timingSafeEqual(expected, presented);
}

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.gateways = new Set();
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
    this.wss = new WebSocket.Server({ host, port, maxPayload: 64 * 1024 });

    // Handle new connections
    this.wss.on('connection', (ws, req) => {
      console.log('Client connected');
      
      // Add client to our set
      this.clients.add(ws);

      // Gateways authenticate with ?token=, an X-Gateway-Token header, or a first {type: 'auth', token} message
      const url = new URL(req.url || '/', 'http://localhost');
      if (isValidGatewayToken(url.searchParams.get('token') || req.headers['x-gateway-token'])) {
        this.authorizeGateway(ws);
      } else if (GATEWAY_AUTH_REQUIRED) {
        const authTimeout = setTimeout(() => {
          if (!this.gateways.has(ws)) {
            ws.close(4401, 'Unauthorized');
          }
        }, AUTH_TIMEOUT_MS);
        ws.once('close', () => clearTimeout(authTimeout));
      }

      ws.on('message', (data) => this.handleMessage(ws, data));

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
        this.gateways.delete(ws);
        
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
        this.gateways.delete(ws);
        
        // Clean up interval
        const clientInterval = this.intervals.get(ws);
        if (clientInterval) {
          clearInterval(clientInterval);
          this.intervals.delete(ws);
        }
      });
    });

    console.log(`WebSocket server running on ws://${host}:${port}`);
    if (GATEWAY_AUTH_REQUIRED) {
      console.log('Gateway authentication is required');
    } else {
      console.log(`WARNING: gateway authentication is not required, SMS jobs are sent to every connected client${GATEWAY_TOKEN ? '' : ' (GATEWAY_TOKEN is not set, so received SMS are rejected)'}`);
    }
  }

  /**
   * Mark a client as an authenticated gateway
   * @param {WebSocket} ws
   */
  authorizeGateway(ws) {
    this.gateways.add(ws);
    console.log('Gateway authenticated');

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'auth_ok' }));
    }
  }

  /**
   * Handle a message sent by a client
   * @param {WebSocket} ws
   * @param {Buffer|string} data
   */
  async handleMessage(ws, data) {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      return;
    }

    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'auth') {
      if (isValidGatewayToken(message.token)) {
        this.authorizeGateway(ws);
      } else if (GATEWAY_TOKEN) {
        ws.close(4401, 'Unauthorized');
      } else {
        // Keep the connection so a gateway shipped with a token still sends SMS before the relay has one
        ws.send(JSON.stringify({ type: 'auth_unavailable' }));
      }
      return;
    }

    if (message.type === 'sms_received') {
      await this.handleInboundSms(ws, message);
    }
  }

  /**
   * Forward an SMS received by a gateway to the API, then acknowledge it so the gateway stops retrying
   * @param {WebSocket} ws
   * @param {{id: string, from: string, body: string, received_at?: string}} sms
   */
  async handleInboundSms(ws, sms) {
    const reply = (payload) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    if (!this.gateways.has(ws)) {
      reply({ type: 'error', id: sms.id, error: 'Only authenticated gateways can submit received SMS' });
      return;
    }

    if (typeof sms.id !== 'string' || typeof sms.from !== 'string' || typeof sms.body !== 'string') {
      reply({ type: 'ack', id: sms.id, status: 'rejected', error: 'id, from and body are required strings' });
      return;
    }

    const result = await forwardInboundSms(sms);
    console.log(`Inbound SMS ${sms.id} from ${maskPhone(sms.from)}: ${result.ok ? 'forwarded' : `failed (${result.status || result.error})`}`);

    if (result.ok || !result.retry) {
      reply({ type: 'ack', id: sms.id, status: result.ok ? 'accepted' : 'rejected' });
    } else {
      reply({ type: 'nack', id: sms.id, retry: true });
    }
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
    const recipients = GATEWAY_AUTH_REQUIRED ? this.gateways : this.clients;
    recipients.forEach((ws) => {
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
   * Get the number of authenticated gateways
   * @returns {number} Number of authenticated gateways
   */
  getGatewayCount() {
    return this.gateways.size;
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
    this.gateways.clear();

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
  getGatewayCount: () => webSocketService.getGatewayCount(),
  getConnectedClients: () => webSocketService.getConnectedClients(),
  close: () => webSocketService.close()
};

