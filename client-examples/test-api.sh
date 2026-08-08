#!/bin/bash

# Example script showing how to make HTTP requests to WebSocket API from another container
# This can be run from any container on the same Docker network

# Base URL using service name
API_BASE_URL="http://websocket-app:3000/api"

echo "🚀 Testing WebSocket API from Docker container..."
echo "API Base URL: $API_BASE_URL"
echo ""

# Test health endpoint
echo "💚 Testing health endpoint..."
curl -s "$API_BASE_URL/health" | jq '.' || echo "Health check failed"
echo ""

# Test status endpoint
echo "📊 Testing status endpoint..."
curl -s "$API_BASE_URL/status" | jq '.' || echo "Status check failed"
echo ""

# Test SMS send endpoint
echo "📱 Testing SMS send endpoint..."
curl -X POST "$API_BASE_URL/sms/send" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "+1234567890",
    "message": "Hello from cURL in Docker container!"
  }' \
  -s | jq '.' || echo "SMS send failed"
echo ""

# Test broadcast endpoint
echo "📢 Testing broadcast endpoint..."
curl -X POST "$API_BASE_URL/broadcast" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "System broadcast from Docker container",
    "type": "system-alert"
  }' \
  -s | jq '.' || echo "Broadcast failed"
echo ""

# Test clients endpoint
echo "👥 Testing clients endpoint..."
curl -s "$API_BASE_URL/clients" | jq '.' || echo "Clients check failed"
echo ""

# Test send endpoint
echo "🧪 Testing test endpoint..."
curl -X POST "$API_BASE_URL/test" \
  -H "Content-Type: application/json" \
  -s | jq '.' || echo "Test endpoint failed"
echo ""

echo "✅ All tests completed!"