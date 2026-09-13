import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('vercel-dist', { recursive: true });
await copyFile('public/mario.html', 'vercel-dist/index.html');
await copyFile('public/mario.html', 'vercel-dist/mario.html');
await copyFile('public/favicon.svg', 'vercel-dist/favicon.svg');
await copyFile('public/THIRD_PARTY_LICENSES.txt', 'vercel-dist/THIRD_PARTY_LICENSES.txt');
console.log('Vercel static site ready in vercel-dist/.');
