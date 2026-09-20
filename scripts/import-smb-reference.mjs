import ts from 'typescript';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = await readFile('work/smb-reference/fsm-maps.js', 'utf8');
const file = ts.createSourceFile(
  'reference.js',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
let library;
function find(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(file) === '"library"')
    library = node.initializer.arguments[0];
  ts.forEachChild(node, find);
}
find(file);
if (!library || !ts.isArrayLiteralExpression(library))
  throw new Error('Map library was not found');
// Parse only literal map data. Never evaluate downloaded JavaScript.
function literal(node) {
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties.map((p) => {
        if (!ts.isPropertyAssignment(p))
          throw new Error('Unsupported property');
        return [p.name.text ?? p.name.getText(file), literal(p.initializer)];
      }),
    );
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken
  )
    return -literal(node.operand);
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isIdentifier(node) && node.text === 'Infinity') return 'Infinity';
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node))
    return { referenceFunction: node.getText(file) };
  throw new Error(`Unsupported map syntax: ${node.getText(file).slice(0, 90)}`);
}
const maps = literal(library).filter((m) => /^[1-8]-[1-4]$/.test(m.name));
if (maps.length !== 32) throw new Error(`Expected 32 maps, got ${maps.length}`);
await mkdir('app/game/reference', { recursive: true });
await writeFile(
  'app/game/reference/smb-nes.json',
  JSON.stringify(maps, null, 2) + '\n',
);
const downloads = JSON.parse(
  await readFile('work/smb-reference/download-manifest.json', 'utf8'),
);
const tree = JSON.parse(await readFile('work/smb-reference/tree.json', 'utf8'));
const manifest = {
  game: 'Super Mario Bros. (NES, 1985)',
  layoutSource: 'https://github.com/jaggedsoft/FullScreenMario',
  gitTree: 'bfca69940aa999e607772f943015ad5f2faf7b7d',
  sourceCommit: '1dfe618bfa966dcad6b91e91aa67649bb869b442',
  sourceBlob: tree.tree.find((f) => f.path === 'Source/settings/maps.js').sha,
  layoutSha256: createHash('sha256').update(source).digest('hex'),
  mapIndex: 'https://themushroomkingdom.net/maps/smb',
  maps: maps.map((m) => {
    const image = downloads.find((d) => d.name === `${m.name}.png`);
    return {
      level: m.name,
      referencePage: `https://themushroomkingdom.net/maps/smb/${m.name}`,
      imageUrl: image.url,
      imageSha256: image.sha256,
      areas: m.areas.length,
      locations: m.locations.length,
    };
  }),
};
await writeFile(
  'references/smb-nes/manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
await writeFile(
  'references/smb-nes/LICENSE-FullScreenMario.txt',
  await readFile('work/smb-reference/LICENSE.txt'),
);
const counts = {};
for (const m of maps) {
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (x.thing || x.macro) {
      const key = (x.macro ? 'macro:' : 'thing:') + (x.macro || x.thing);
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const v of Object.values(x)) walk(v);
  };
  walk(m);
}
console.log(
  JSON.stringify(
    {
      maps: maps.length,
      areas: maps.reduce((n, m) => n + m.areas.length, 0),
      objects: counts,
    },
    null,
    2,
  ),
);
