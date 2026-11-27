/**
 * Serve the web build for browser previews.
 *
 * `npm run build-electron` rewrites index.html to load the desktop bundle
 * (`dist/bundle.electron.js`), which needs Electron's Node integration and
 * cannot run in a normal browser. Anyone who previews the repository in a
 * browser after a desktop build, or who builds while a static server is
 * running, ends up with a page that dies with
 * "Dynamic require of \"fs\" is not supported".
 *
 * This script: (1) switches index.html to the web bundle, (2) rebuilds
 * dist/bundle.js, and (3) starts a small static server. It is safe to run
 * repeatedly and it never leaves index.html pointing at the desktop bundle.
 *
 * Usage: node ./scripts/serve_web.mjs [--port 8811] [--host 0.0.0.0]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { useBundle } from './index_html.mjs';

const args = process.argv.slice(2);
function arg(name, fallback) {
	const index = args.indexOf('--' + name);
	return index === -1 ? fallback : args[index + 1];
}

const port = parseInt(arg('port', process.env.PORT || '8811'));
const host = arg('host', process.env.HOST || '0.0.0.0');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// 1) index.html must load the web bundle before the browser build starts.
const result = useBundle('web');
console.log('[serve-web] index.html ' + (result === 'already' ? 'already loads' : 'now loads') + ' dist/bundle.js');

// 2) Rebuild the web bundle unless it is newer than every source directory.
function newestMtime(dir) {
	let newest = 0;
	for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
		if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
		const full = path.join(dir, entry.name);
		const stat = fs.statSync(full);
		if (stat.isDirectory()) newest = Math.max(newest, newestMtime(full));
		else newest = Math.max(newest, stat.mtimeMs);
	}
	return newest;
}
const bundle_path = path.join(root, 'dist', 'bundle.js');
const needs_build = !fs.existsSync(bundle_path)
	|| fs.statSync(bundle_path).mtimeMs < newestMtime(path.join(root, 'js'));

if (needs_build) {
	console.log('[serve-web] building dist/bundle.js ...');
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [path.join(root, 'build.mjs'), '--target=web'], {
			cwd: root,
			stdio: 'inherit',
		});
		child.on('exit', code => code === 0 ? resolve() : reject(new Error('build failed with code ' + code)));
	});
} else {
	console.log('[serve-web] dist/bundle.js is up to date');
}

// 3) Minimal static server. No host/origin allow list so the preview proxy
//    (https://<port>-<sandbox>.e2b.app) works, and no caching of index.html.
const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.map': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.glsl': 'text/plain; charset=utf-8',
	'.vert': 'text/plain; charset=utf-8',
	'.frag': 'text/plain; charset=utf-8',
	'.bbtheme': 'text/plain; charset=utf-8',
	'.bbkeymap': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
	const url_path = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
	let file = path.join(root, url_path === '/' ? 'index.html' : url_path);

	// Never serve anything outside the repository root.
	if (!file.startsWith(root + path.sep) && file !== root) {
		res.writeHead(403).end('Forbidden');
		return;
	}

	fs.stat(file, (error, stat) => {
		if (!error && stat.isDirectory()) file = path.join(file, 'index.html');
		fs.readFile(file, (read_error, data) => {
			if (read_error) {
				res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Not found: ' + url_path);
				return;
			}
			res.writeHead(200, {
				'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
				'Cache-Control': 'no-store',
				'Access-Control-Allow-Origin': '*',
			});
			res.end(data);
		});
	});
});

server.listen(port, host, () => {
	console.log(`[serve-web] Blockbench web build on http://${host}:${port}/`);
});
