import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { handleDownloadPage } from './controllers/downloadController.js';
import { verifyWebhook, handleWebhookEvent } from './controllers/webhookController.js';
import { initDb } from './db/index.js';

dotenv.config();

const app = express();

// Initialize DB schema asynchronously
initDb().catch(err => console.error('[App] Database init failed:', err.message));

// Security middleware with relaxed CSP for media streaming & inline countdown scripts
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check & Status
app.get('/', (req, res) => {
  const botUsername = process.env.BOT_USERNAME || 'hqdownloaderbot';
  res.status(200).json({
    status: 'online',
    service: 'Instagram Reel Downloader Backend',
    bot: `@${botUsername}`,
    storage: 'Invisible Telegram Bucket',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Meta Messenger API Webhook Verification & Message Handler
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleWebhookEvent);

// 24-Hour Expiring Download Landing Page
app.get('/dl/:id', handleDownloadPage);

// 404 handler for other routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[App Error]', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
