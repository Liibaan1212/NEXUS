import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(__dirname, '..', '..', 'ai-engineering-from-scratch-main', 'site');
const PORT = Number(process.env.NEXT_DOOR_PORT) || 4174;

const app = express();
app.use(express.static(SITE_DIR, {
  extensions: ['html'],
}));
app.use((_req, res) => {
  res.status(404).type('text').send('Next Door page not found.');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Next Door standalone site listening on http://0.0.0.0:${PORT}`);
  console.log(`Serving site files from ${SITE_DIR}`);
});
