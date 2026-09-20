// Explicit research utility; never runs as part of the game build.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const commit = '1dfe618bfa966dcad6b91e91aa67649bb869b442';
const tree = 'bfca69940aa999e607772f943015ad5f2faf7b7d';
const root = 'work/smb-reference';
await mkdir(root, { recursive: true });
const items = Array.from({ length: 32 }, (_, i) => {
  const level = `${Math.floor(i / 4) + 1}-${(i % 4) + 1}`;
  return {
    name: `${level}.png`,
    url: `https://themushroomkingdom.net/images/maps/smb/smb_${level}.png`,
  };
});
items.push(
  {
    name: 'fsm-maps.js',
    url: `https://raw.githubusercontent.com/jaggedsoft/FullScreenMario/${commit}/Source/settings/maps.js`,
  },
  {
    name: 'LICENSE.txt',
    url: `https://raw.githubusercontent.com/jaggedsoft/FullScreenMario/${commit}/LICENSE.txt`,
  },
  {
    name: 'tree.json',
    url: `https://api.github.com/repos/jaggedsoft/FullScreenMario/git/trees/${tree}?recursive=1`,
  },
);
const manifest = [];
for (let i = 0; i < items.length; i += 4) {
  const batch = await Promise.all(
    items.slice(i, i + 4).map(async (item) => {
      const response = await fetch(item.url, {
        headers: { 'User-Agent': 'Mario-map-reference/1.0' },
        signal: AbortSignal.timeout(40000),
      });
      if (!response.ok)
        throw new Error(`${item.name}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (
        item.name.endsWith('.png') &&
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        throw new Error(`${item.name}: not a PNG map`);
      await writeFile(`${root}/${item.name}`, bytes);
      return {
        ...item,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    }),
  );
  manifest.push(...batch);
}
await writeFile(
  `${root}/download-manifest.json`,
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  'Collected all 32 annotated maps and pinned layout references. Run npm run import:maps to refresh the data manifest.',
);
