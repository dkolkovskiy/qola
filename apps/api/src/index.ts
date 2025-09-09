import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
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

// Try to use HTTPS with generated certificates, fallback to HTTP for Railway
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
  });
} catch (error) {
  console.log('[api] ⚠️  HTTPS certificates not found, using HTTP for Railway...');
  
  // Fallback to HTTP (required for Railway)
  app.listen(port, '0.0.0.0', () => {
    console.log(`[api] ✅ HTTP server listening on http://0.0.0.0:${port}`);
    console.log(`[api] Health check: /health`);
    console.log(`[api] Avatar interface: /avatar.html`);
    console.log(`[api] Note: Railway provides HTTPS proxy automatically`);
  });
}


