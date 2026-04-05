import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 8765;
const ROOT = process.cwd();
const INBOX_DIR = path.join(ROOT, 'inbox');

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'local-hub', port: PORT });
});

app.post('/packets/web', async (req, res) => {
  const packet = req.body?.packet;
  if (!packet || typeof packet !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing packet string' });
  }

  await fs.mkdir(INBOX_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `web-${timestamp}`;
  const markdownPath = path.join(INBOX_DIR, `${baseName}.md`);
  const metaPath = path.join(INBOX_DIR, `${baseName}.json`);

  await fs.writeFile(markdownPath, packet, 'utf8');
  await fs.writeFile(metaPath, JSON.stringify(req.body, null, 2), 'utf8');

  return res.json({
    ok: true,
    saved: {
      packet: markdownPath,
      metadata: metaPath
    }
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Local hub listening on http://127.0.0.1:${PORT}`);
});
