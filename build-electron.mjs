/**
 * Post-processing step for the desktop build.
 *
 * Electron 22 is the last version that runs on Windows 7 and 8. Chromium
 * requests ES modules with CORS, and a page opened from a local file has the
 * opaque origin `null`, so a `<script type="module">` can not be loaded in
 * the desktop app without passing extra browser flags.
 *
 * esbuild already bundles everything into a single IIFE that has no imports
 * and no exports, so this script only verifies that the bundle is a classic
 * script and applies minification/sourcemap headers if needed. The desktop
 * build therefore loads `dist/bundle.electron.js` as a plain script.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const root = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
const bundle_path = path.join(root, 'dist', 'bundle.electron.js');

if (!fs.existsSync(bundle_path)) {
	console.error(`[build-electron] Missing ${bundle_path}. Run the electron bundle step first.`);
	process.exit(1);
}

let code = fs.readFileSync(bundle_path, {encoding: 'utf-8'});

// Compile the bundle as a classic script. This throws if the bundle still
// contains ES module syntax, which would turn it back into a CORS restricted
// module script and break the app when it is loaded from a local file.
try {
	new vm.Script(code, {filename: 'bundle.electron.js'});
} catch (error) {
	console.error('[build-electron] Desktop bundle is not a valid classic script:', error.message);
	process.exit(1);
}
if (!/^\s*\(\s*(\(\)|function)/.test(code)) {
	// Not an IIFE? Wrap it so the script can never leak bindings into the
	// global scope of the page.
	code = `(() => {\n${code}\n})();\n`;
	fs.writeFileSync(bundle_path, code, {encoding: 'utf-8'});
}

console.log(`[build-electron] Desktop bundle is a classic script (${(code.length / 1e6).toFixed(2)} MB)`);
