# Docker Setup for Simple WebSocket Application

This directory contains Docker configuration files to containerize and deploy the Simple WebSocket application.

## Files Overview

- `Dockerfile` - Main Docker image configuration
- `docker-compose.yml` - Production deployment configuration
- `docker-compose.dev.yml` - Development environment configuration
- `nginx.conf` - Nginx reverse proxy configuration
- `.dockerignore` - Files to exclude from Docker build context

## Quick Start

### Development Mode

```bash
# Start in development mode with volume mounting
npm run docker:dev

# Or manually
docker-compose -f docker-compose.dev.yml up
```

### Production Mode

```bash
# Build and start the application
npm run docker:build
npm run docker:up

# Or manually
docker-compose build
docker-compose up -d

# With nginx reverse proxy
npm run docker:prod
# Or manually
docker-compose --profile production up -d
```

## Available Commands

```bash
# Build Docker images
npm run docker:build

# Start services in background
npm run docker:up

# Stop services
npm run docker:down

# View logs
npm run docker:logs

# Development mode (with volume mounting)
npm run docker:dev

# Production mode (with nginx)
npm run docker:prod
```

## Configuration

### Environment Variables

The application supports these environment variables:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Express server port (default: 3000)
- `WS_PORT` - WebSocket server port (default: 8080)
- `DEBUG` - Debug output (development only)

### Ports

- **3000** - Express HTTP API server
- **8080** - WebSocket server
- **80** - Nginx reverse proxy (production profile)
- **9229** - Node.js debugger (development only)

## Production Deployment

### Basic Deployment

```bash
# Clone the repository
git clone <your-repo>
cd simple-websocket

# Build and start
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### With Nginx Reverse Proxy

```bash
# Start with production profile (includes nginx)
docker-compose --profile production up -d

# Access via:
# - HTTP API: http://localhost/api/
# - WebSocket: ws://localhost/ws
# - Web Client: http://localhost/
```

### Health Checks

The container includes health checks:

```bash
# Check container health
docker-compose ps

# Manual health check
curl http://localhost:3000/api/health
```

## Development

### Hot Reloading

Development mode mounts the source code as a volume:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Make changes to source code - they will be reflected immediately
# (Note: You may need nodemon for automatic restarts)
```

### Debugging

Connect to the Node.js debugger on port 9229:

```bash
# In VS Code, add this to launch.json:
{
  "type": "node",
  "request": "attach",
  "name": "Docker Debug",
  "remoteRoot": "/usr/src/app",
  "localRoot": "${workspaceFolder}",
  "port": 9229,
  "address": "localhost"
}
```

## Scaling

### Multiple Instances

```yaml
# In docker-compose.yml, add:
services:
  websocket-app:
    # ... existing config
    deploy:
      replicas: 3
```

### Load Balancer

Use nginx upstream for load balancing:

```nginx
upstream websocket_backend {
    server websocket-app_1:3000;
    server websocket-app_2:3000;
    server websocket-app_3:3000;
}
```

## Monitoring

### Container Logs

```bash
# View all logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Service-specific logs
docker-compose logs websocket-app
docker-compose logs nginx
```

### Container Stats

```bash
# Resource usage
docker stats

# Container info
docker-compose ps
```

## Security Considerations

### Production Security

1. **Non-root User**: Container runs as non-root user `nodejs`
2. **Security Headers**: Nginx adds security headers
3. **Rate Limiting**: API and WebSocket rate limiting in nginx
4. **SSL**: Uncomment HTTPS section in nginx.conf and add certificates

### SSL Setup

```bash
# Create ssl directory
mkdir ssl

# Add your certificates
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem

# Uncomment HTTPS section in nginx.conf
# Restart services
docker-compose --profile production down
docker-compose --profile production up -d
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -i :3000
   lsof -i :8080
   
   # Change ports in docker-compose.yml
   ports:
     - "3001:3000"  # Use 3001 instead of 3000
   ```

2. **Permission Issues**
   ```bash
   # Fix file permissions
   sudo chown -R $(id -u):$(id -g) .
   ```

3. **Build Issues**
   ```bash
   # Clean build
   docker-compose down
   docker system prune -f
   docker-compose build --no-cache
   ```

### Logs and Debugging

```bash
# Container logs
docker-compose logs websocket-app

# Enter container for debugging
docker-compose exec websocket-app sh

# Check container health
docker-compose ps
curl http://localhost:3000/api/health
```

## Performance Tuning

### Node.js Optimization

Add to Dockerfile:

```dockerfile
# Production optimizations
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"
```

### Nginx Optimization

Add to nginx.conf:

```nginx
# Worker processes
worker_processes auto;

# Connection optimization
events {
    worker_connections 4096;
    use epoll;
}

# Gzip compression
gzip on;
gzip_types text/plain application/json text/css application/javascript;
```

## Backup and Data

### Volume Backup

```bash
# Backup logs
docker run --rm -v simple-websocket_app-logs:/data -v $(pwd)/backup:/backup alpine tar czf /backup/logs-$(date +%Y%m%d).tar.gz -C /data .
```

### Configuration Backup

```bash
# Backup configuration
tar czf config-backup-$(date +%Y%m%d).tar.gz docker-compose.yml nginx.conf Dockerfile
```