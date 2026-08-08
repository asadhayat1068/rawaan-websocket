const axios = require('axios');

// WebSocket API base URL using service name
const API_BASE_URL = 'http://websocket-app:3000/api';

async function sendSMSMessage(recipient, message) {
  try {
    console.log(`\n📱 Sending SMS to ${recipient}...`);
    
    const response = await axios.post(`${API_BASE_URL}/sms/send`, {
      recipient: recipient,
      message: message
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ SMS Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ SMS Error:', error.response?.data || error.message);
    throw error;
  }
}

async function broadcastMessage(message, type = 'notification') {
  try {
    console.log(`\n📢 Broadcasting message: "${message}"...`);
    
    const response = await axios.post(`${API_BASE_URL}/broadcast`, {
      message: message,
      type: type
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Broadcast Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Broadcast Error:', error.response?.data || error.message);
    throw error;
  }
}

async function getStatus() {
  try {
    console.log('\n📊 Getting server status...');
    
    const response = await axios.get(`${API_BASE_URL}/status`);
    
    console.log('✅ Status Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Status Error:', error.response?.data || error.message);
    throw error;
  }
}

async function getHealth() {
  try {
    console.log('\n💚 Checking server health...');
    
    const response = await axios.get(`${API_BASE_URL}/health`);
    
    console.log('✅ Health Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Health Error:', error.response?.data || error.message);
    throw error;
  }
}

// Main function to test all endpoints
async function testAllEndpoints() {
  console.log('🚀 Starting WebSocket API tests from Docker container...');
  
  try {
    // Wait a bit for the websocket service to be ready
    console.log('⏳ Waiting for WebSocket service to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test health check
    await getHealth();
    
    // Test status
    await getStatus();
    
    // Test SMS sending
    await sendSMSMessage('+1234567890', 'Hello from Node.js Docker container!');
    
    // Test broadcasting
    await broadcastMessage('System notification from Docker container', 'system');
    
    // Test another SMS
    await sendSMSMessage('+0987654321', 'Another test message!');
    
    // Final status check
    await getStatus();
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAllEndpoints();
}

module.exports = {
  sendSMSMessage,
  broadcastMessage,
  getStatus,
  getHealth
};