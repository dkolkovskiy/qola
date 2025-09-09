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
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[api] ❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Keep process alive - don't exit on errors, let Railway handle restarts
process.on('SIGTERM', () => {
  console.log('[api] 🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[api] 🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// For Railway - use HTTP only to avoid health check issues
// Railway provides HTTPS termination automatically
console.log('[api] Using HTTP for Railway deployment (Railway provides HTTPS proxy)');

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[api] ✅ HTTP server listening on http://0.0.0.0:${port}`);
  console.log(`[api] Health check: /health`);
  console.log(`[api] Avatar interface: /avatar.html`);
  console.log(`[api] Note: Railway provides HTTPS proxy automatically`);
  console.log(`[api] Ready to serve requests`);
  
  // Add heartbeat to keep process alive
  setInterval(() => {
    console.log(`[api] 💓 Heartbeat - Server running on port ${port}`);
  }, 60000); // Every minute
});

server.on('error', (error) => {
  console.error('[api] ❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`[api] Port ${port} is already in use`);
  }
});

server.on('listening', () => {
  console.log(`[api] 🚀 Server is ready and listening for connections`);
});


