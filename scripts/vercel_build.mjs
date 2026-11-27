/**
 * Build the deployment for Vercel.
 *
 * Vercel runs this as the project's build command. It:
 *
 * 1. writes `build-info.json`, which the Rust function embeds when it compiles;
 * 2. switches index.html to the web bundle and builds `dist/bundle.js`;
 * 3. assembles `public/`, the directory the Rust preset serves as static files.
 *
 * Why a separate directory instead of serving the repository root: the Rust
 * preset maps static files to `public/` and hands every other path to the
 * function, so anything inside `public/` is a candidate URL. Copying an
 * explicit list keeps source, CI configuration and `node_modules` unreachable
 * while still shipping every file the editor asks for at runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {useBundle} from './index_html.mjs';

const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), '..');
const public_dir = path.join(root, 'public');

// If this runs on a branch that does not have the website files, Vercel reports
// a missing output directory rather than the real cause. Say it plainly.
for (const required of ['index.html', 'package.json', 'build.mjs', 'publisher/index.html']) {
	if (!fs.existsSync(path.join(root, required))) {
		throw new Error(
			`[vercel] ${required} is missing from this checkout. The website files live on the ` +
				`arena/d5dca684-blockbench-windows-7-64-bit branch; check the branch selected in Vercel.`
		);
	}
}

/** Directories the editor fetches from at runtime. */
const ASSET_DIRECTORIES = ['assets', 'css', 'font', 'icons', 'themes', 'keymaps', 'lang', 'content', 'lib'];

/** Individual files served from the site root. */
const ROOT_FILES = [
	'favicon.png',
	'icon.png',
	'icon_full.png',
	'icon_maskable.png',
	'manifest.webmanifest',
];

function run(script, args = []) {
	execFileSync(process.execPath, [path.join(root, script), ...args], {
		cwd: root,
		stdio: 'inherit',
	});
}

function copy_dir(from, to) {
	fs.cpSync(from, to, {
		recursive: true,
		// Source maps are for debugging a local build and are large; the editor
		// never requests them.
		filter: source => !source.endsWith('.map'),
	});
}

// 1) Data shared by the function and the landing page.
run('scripts/site.mjs');

// 2) The web bundle. `useBundle('web')` rewrites index.html so the packaged
//    desktop build is not accidentally published, and building explicitly here
//    means a stale dist/ from a previous step can never be shipped.
const bundle = useBundle('web');
if (bundle === 'error') {
	throw new Error('[vercel] index.html does not contain a bundle script tag');
}
if (bundle === 'inline-defer') {
	throw new Error(
		'[vercel] index.html has an inline <script defer> loading check, which reports a false startup error'
	);
}
console.log('[vercel] index.html now loads dist/bundle.js');
run('build.mjs', ['--target=web']);

// 3) Assemble public/.
fs.rmSync(public_dir, {recursive: true, force: true});
fs.mkdirSync(public_dir, {recursive: true});

for (const directory of ASSET_DIRECTORIES) {
	const from = path.join(root, directory);
	if (!fs.existsSync(from)) {
		throw new Error(`[vercel] expected asset directory ${directory}/ to exist`);
	}
	copy_dir(from, path.join(public_dir, directory));
}

for (const file of ROOT_FILES) {
	const from = path.join(root, file);
	if (!fs.existsSync(from)) {
		throw new Error(`[vercel] expected ${file} to exist`);
	}
	fs.copyFileSync(from, path.join(public_dir, file));
}

// The editor owns the site root. index.html loads its stylesheets, fonts and
// bundle relative to that document, so it has to sit where those directories
// are siblings of it. Serving it from a subdirectory made every stylesheet
// resolve one level too deep (/app/css/setup.css), and the compatibility check
// then reported "Incompatible browser version" on a browser that is fine.
fs.copyFileSync(path.join(root, 'index.html'), path.join(public_dir, 'index.html'));
fs.mkdirSync(path.join(public_dir, 'dist'), {recursive: true});
fs.copyFileSync(path.join(root, 'dist', 'bundle.js'), path.join(public_dir, 'dist', 'bundle.js'));

// The download page does not depend on relatives, so it can live in its own
// directory and link back up to the editor at /.
fs.mkdirSync(path.join(public_dir, 'download'), {recursive: true});
fs.copyFileSync(
	path.join(root, 'publisher', 'index.html'),
	path.join(public_dir, 'download', 'index.html')
);
copy_dir(path.join(root, 'publisher'), path.join(public_dir, 'publisher'));

const bytes = directory_size(public_dir);
console.log(`[vercel] public/ assembled: ${(bytes / 1024 / 1024).toFixed(1)} MB`);

/**
 * Total size of a directory tree, for the build log.
 * @param {string} directory
 * @returns {number}
 */
function directory_size(directory) {
	let total = 0;
	for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
		const full = path.join(directory, entry.name);
		total += entry.isDirectory() ? directory_size(full) : fs.statSync(full).size;
	}
	return total;
}
