# Production Deployment Guide

This guide explains how to properly deploy the Yangkar SvelteKit application to a production environment.

## Backend Deployment

### Prerequisites

- Node.js 18+
- PNPM package manager
- PostgreSQL database
- Nginx or similar web server for reverse proxy

### Production Setup

1. Clone the repository:

```bash
git clone https://github.com/RabjamX2/YangkarSvelteKit.git
cd YangkarSvelteKit
```

2. Install dependencies:

```bash
pnpm install
```

3. Generate Prisma files for production:

```bash
cd apps/backend
pnpm run prisma:generate:prod
```

4. Set up environment variables in a `.env` file:

```
DATABASE_URL=postgresql://user:password@localhost:5432/yangkar
FRONT_END_URL=https://yangkarbhoeche.com
NODE_ENV=production
JWT_ACCESS_SECRET=your_very_long_secure_access_token_secret
JWT_REFRESH_SECRET=your_very_long_secure_refresh_token_secret
PORT=4000
```

5. Start the application:

```bash
cd apps/backend
pnpm start
```

## Nginx Configuration

Here's a sample Nginx configuration for the backend API:

```nginx
server {
    listen 80;
    server_name api.yangkarbhoeche.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yangkarbhoeche.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Process Management

For production deployments, use a process manager like PM2:

```bash
npm install -g pm2
pm2 start apps/backend/src/index.js --name "yangkar-api"
pm2 save
pm2 startup
```

## Important Production Notes

1. The application is configured to trust proxies in production for proper IP-based rate limiting.
2. Always use HTTPS in production.
3. Ensure database backups are configured.
4. For high-traffic sites, consider additional security measures like Cloudflare.
