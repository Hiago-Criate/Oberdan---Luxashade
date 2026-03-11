import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { calculatePrice } from './server/calculator.js';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// API Routes
app.post('/api/calculate', (req, res) => {
  try {
    const price = calculatePrice(req.body);
    res.json({ price });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/submit-order', async (req, res) => {
  try {
    const WEBHOOK_URL = 'https://147hook.criate.online/webhook/94e9c23d-4b00-40aa-8e20-8e4da2c94907';
    await axios.post(WEBHOOK_URL, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to submit order' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
