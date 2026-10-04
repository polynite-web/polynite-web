// Verify the generated Emscripten launcher and binary before copying a release.
const fs = require('node:fs');
const path = require('node:path');
try {
  const root = process.argv[2] || path.join(__dirname, 'dev');
  const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const module = new WebAssembly.Module(fs.readFileSync(path.join(root, 'app.wasm')));
  const table = js.match(/var wasmImports=\{([^]*?)\};/);
  const binding = js.match(/function getWasmImports\(\)\{var imports=\{([^}]+)\}/);
  if (!table || !binding) throw new Error('Unrecognized launcher import layout; verify the generated pair before publishing.');
  const names = new Set([...table[1].matchAll(/(?:^|,)([A-Za-z_$][\w$]*):/g)].map(m => m[1]));
  const namespaces = new Set([...binding[1].matchAll(/(?:^|,)([A-Za-z_$][\w$]*):wasmImports/g)].map(m => m[1]));
  const imports = WebAssembly.Module.imports(module);
  const missing = imports.filter(i => !namespaces.has(i.module) || !names.has(i.name));
  if (missing.length) throw new Error(`Incompatible app.js/app.wasm: ${missing.length} missing imports; first ${missing[0].module}.${missing[0].name}`);
  console.log(`[polynite] Engine pair imports verified (${imports.length}); this is not a browser runtime test.`);
} catch (error) {
  console.error('[polynite] ' + error.message);
  process.exitCode = 1;
}
