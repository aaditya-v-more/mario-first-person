import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import vm from 'node:vm';
const manifest=JSON.parse(await readFile('plethora/plethora.json','utf8'));
const result=await build({
  stdin:{contents:"export {init} from './plethora/main';",resolveDir:process.cwd(),loader:'ts'},
  bundle:true,write:false,format:'iife',globalName:'MarioBit',target:'es2020',minify:true,
  plugins:[{name:'plethora-registry-only',setup(build){
    build.onResolve({filter:/^three$/},()=>({path:resolve('plethora/three-registry.ts')}));
    build.onResolve({filter:/browser-runtime$/},()=>({path:'browser-runtime',namespace:'plethora'}));
    build.onLoad({filter:/.*/,namespace:'plethora'},()=>({contents:'export function createBrowserRuntime(){throw new Error("Plethora runtime required");} export function createTextureCanvas(){throw new Error("Plethora canvas factory required");}',loader:'js'}));
  }}],
  metafile:true,
});
const source=result.outputFiles[0].text+'\nwindow.plethoraBit={init:MarioBit.init};\n';
new vm.Script(source);
if(Object.keys(result.metafile.inputs).some(path=>path.includes('node_modules')))throw new Error('Third-party code must load from the Plethora registry.');
for(const forbidden of [/requestAnimationFrame\s*\(/,/\.addEventListener\s*\(/,/document\.body/,/document\.createElement\s*\(/,/\bfetch\s*\(/,/https?:\/\//])if(forbidden.test(source))throw new Error(`Disallowed runtime pattern: ${forbidden}`);
const payload={title:manifest.title,description:manifest.description,tags:manifest.tags,source,manifest,generated:true};
const bytes=Buffer.byteLength(JSON.stringify(payload));
if(bytes>2097152)throw new Error(`Package exceeds 2 MiB: ${bytes}`);
await mkdir('outputs/plethora',{recursive:true});
await writeFile('outputs/plethora/main.js',source);
await writeFile('outputs/plethora/plethora.json',JSON.stringify(manifest,null,2)+'\n');
await writeFile('outputs/plethora/draft.json',JSON.stringify(payload));
console.log(`Plethora draft built: ${bytes.toLocaleString()} bytes; registry-only dependencies, syntax, and runtime checks passed.`);
