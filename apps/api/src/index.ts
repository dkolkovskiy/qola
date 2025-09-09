import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import https from 'https';
import { router as aiRouter } from './routes/ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/ai', aiRouter);

// Serve avatar.html with API key injection
app.get('/avatar.html', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  // Read the avatar.html file and inject the API key
  const avatarHtmlPath = path.join(__dirname, '../avatar.html');
  let avatarHtml = readFileSync(avatarHtmlPath, 'utf8');

  // Replace the placeholder API key with the actual one
  const apiKey = process.env.HEYGEN_STREAMING_API_KEY || 'your-api-key-here';
  avatarHtml = avatarHtml.replace('YOUR_HEYGEN_API_KEY_HERE', apiKey);

  res.send(avatarHtml);
});

const port = process.env.PORT || 4000;

console.log(`[api] Starting server on port ${port}...`);
console.log(`[api] Environment: ${process.env.NODE_ENV || 'development'}`);

// Add global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('[api] ❌ Uncaught Exception:', error);
  console.error('[api] Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[api] ❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Keep process alive
process.on('SIGTERM', () => {
  console.log('[api] 🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[api] 🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Generate self-signed certificates for HTTPS at runtime
const generateCertificates = () => {
  const certsDir = path.join(__dirname, '../certs');
  const keyPath = path.join(certsDir, 'server.key');
  const certPath = path.join(certsDir, 'server.crt');
  
  // Create certs directory if it doesn't exist
  if (!existsSync(certsDir)) {
    mkdirSync(certsDir, { recursive: true });
    console.log('[api] Created certs directory');
  }
  
  // Generate certificates if they don't exist
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    try {
      console.log('[api] Generating self-signed SSL certificates...');
      execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=QOLA Development/OU=IT Department/CN=localhost"`, { stdio: 'pipe' });
      console.log('[api] ✅ SSL certificates generated successfully');
      return true;
    } catch (error) {
      console.log('[api] ⚠️  Failed to generate SSL certificates:', error.message);
      return false;
    }
  }
  
  console.log('[api] SSL certificates already exist');
  return true;
};

// Try to generate/use HTTPS certificates
const certsAvailable = generateCertificates();

if (certsAvailable) {
  try {
    const httpsOptions = {
      key: readFileSync(path.join(__dirname, '../certs/server.key')),
      cert: readFileSync(path.join(__dirname, '../certs/server.crt'))
    };

    const server = https.createServer(httpsOptions, app);

    server.listen(port, '0.0.0.0', () => {
      console.log(`[api] ✅ HTTPS server listening on https://0.0.0.0:${port}`);
      console.log(`[api] HTTPS enabled for WebRTC compatibility`);
      console.log(`[api] Health check: /health`);
      console.log(`[api] Avatar interface: /avatar.html`);
      console.log(`[api] Note: Self-signed certificate - browsers will show security warning`);
      
      // Add heartbeat to keep process alive
      setInterval(() => {
        console.log(`[api] 💓 Heartbeat - Server running on port ${port}`);
      }, 60000); // Every minute
    });

    server.on('error', (error) => {
      console.error('[api] ❌ HTTPS server error:', error);
      process.exit(1);
    });
  } catch (error) {
    console.log('[api] ❌ HTTPS server failed to start:', error.message);
    console.log('[api] Falling back to HTTP...');
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`[api] ✅ HTTP server listening on http://0.0.0.0:${port}`);
      console.log(`[api] Health check: /health`);
      console.log(`[api] Avatar interface: /avatar.html`);
      console.log(`[api] ⚠️  WebRTC may not work properly without HTTPS`);
      
      // Add heartbeat to keep process alive
      setInterval(() => {
        console.log(`[api] 💓 Heartbeat - Server running on port ${port}`);
      }, 60000); // Every minute
    });
  }
} else {
  console.log('[api] Using HTTP fallback (no SSL certificates available)');
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`[api] ✅ HTTP server listening on http://0.0.0.0:${port}`);
    console.log(`[api] Health check: /health`);
    console.log(`[api] Avatar interface: /avatar.html`);
    console.log(`[api] ⚠️  WebRTC may not work properly without HTTPS`);
    
    // Add heartbeat to keep process alive
    setInterval(() => {
      console.log(`[api] 💓 Heartbeat - Server running on port ${port}`);
    }, 60000); // Every minute
  });
}


