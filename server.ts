import express from 'express';
import { createServer as createViteServer } from 'vite';
import * as cheerio from 'cheerio';
import axios from 'axios';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple, clean scraper endpoint
  app.post('/api/scrape', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL required' });

      const targetUrl = url.startsWith('http') ? url : `https://${url}`;
      
      const response = await axios.get(targetUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
        },
        timeout: 8000 // Give it max 8 seconds before timing out
      });

      const $ = cheerio.load(response.data);
      $('script, style, noscript, iframe, img, svg').remove();
      
      const cleanText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 3000);
      
      res.json({ scrapedKnowledge: cleanText });
    } catch (error) {
      console.error('Scrape error:', error);
      // Graceful fallback: return empty so the frontend fallback logic triggers
      res.json({ scrapedKnowledge: '' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
