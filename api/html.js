import { readFileSync } from 'fs';
import { join } from 'path';
export default function handler(req, res) {
  const html = readFileSync(join(process.cwd(), 'appscript-index.html'), 'utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send(html);
}
