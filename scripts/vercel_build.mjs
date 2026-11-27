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
import crypto from 'node:crypto';
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
fs.mkdirSync(path.join(public_dir, 'dist'), {recursive: true});

// Publish the bundle under a name that changes with its contents.
//
// dist/bundle.js is referenced by a fixed name, and it was previously served
// with a one year immutable cache. Browsers that loaded it once kept using that
// copy forever, because immutable tells them not to revalidate, while the
// uncached index.html kept being updated. The result was a new page driving an
// old bundle, which shows up as a blank screen and as dialogs missing controls
// that do exist in the source. A content addressed name gives every build a URL
// that no browser has cached, so the fix reaches machines that are already
// stuck, not only ones that visit for the first time.
const bundle_path = path.join(root, 'dist', 'bundle.js');
const bundle_hash = crypto.createHash('sha256').update(fs.readFileSync(bundle_path)).digest('hex').slice(0, 12);
const bundle_name = `bundle.${bundle_hash}.js`;
fs.copyFileSync(bundle_path, path.join(public_dir, 'dist', bundle_name));

let shell = fs.readFileSync(path.join(root, 'index.html'), {encoding: 'utf-8'});
shell = shell.replace('src="dist/bundle.js"', `src="dist/${bundle_name}"`);
if (!shell.includes(`src="dist/${bundle_name}"`)) {
	throw new Error('[vercel] could not point index.html at the hashed bundle');
}
fs.writeFileSync(path.join(public_dir, 'index.html'), shell);
console.log(`[vercel] bundle published as dist/${bundle_name}`);

// The download page does not depend on relatives, so it can live in its own
// directory and link back up to the editor at /.
fs.mkdirSync(path.join(public_dir, 'download'), {recursive: true});
fs.copyFileSync(
	path.join(root, 'publisher', 'index.html'),
	path.join(public_dir, 'download', 'index.html')
);
copy_dir(path.join(root, 'publisher'), path.join(public_dir, 'publisher'));

// The Fresh Moves glasses fix gets its own page and its own zips.
//
// `publisher/fresh-moves/` is not reachable on its own because `publisher/` is
// only copied wholesale under /publisher, and that path also carries the
// download page. So the page is copied to /fresh-moves for the URL and its
// zips are copied to /download/fresh-moves for the links the page generates.
fs.mkdirSync(path.join(public_dir, 'fresh-moves'), {recursive: true});
fs.copyFileSync(
	path.join(root, 'publisher', 'fresh-moves', 'index.html'),
	path.join(public_dir, 'fresh-moves', 'index.html')
);
for (const script of ['site.js', 'list.js']) {
	fs.copyFileSync(
		path.join(root, 'publisher', 'fresh-moves', script),
		path.join(public_dir, 'fresh-moves', script)
	);
}

// A summary page for the Glowing Eyes mod. It lives on its own path rather than
// in public/ because public/ is rebuilt from an explicit list on every build,
// and this page carries its own images. The script copies both, so a missing
// asset fails the build instead of shipping a page with broken images.
const glowing_dir = path.join(root, 'publisher', 'glowingeyes');
if (fs.existsSync(glowing_dir)) {
	const glowing_files = fs.readdirSync(glowing_dir);
	const required = ['index.html', 'logo.png'];
	for (const needed of required) {
		if (!glowing_files.includes(needed)) {
			throw new Error(`[vercel] publisher/glowingeyes/${needed} is missing`);
		}
	}
	const glowing_out = path.join(public_dir, 'glowingeyes');
	fs.mkdirSync(glowing_out, {recursive: true});
	for (const file of glowing_files) {
		fs.copyFileSync(path.join(glowing_dir, file), path.join(glowing_out, file));
	}
	console.log(`[vercel] published Glowing Eyes page with ${glowing_files.length} files`);
}

const pack_dir = path.join(root, 'fresh-moves-glasses', 'builds');
if (fs.existsSync(pack_dir)) {
	const packs = fs.readdirSync(pack_dir).filter(name => name.endsWith('.zip'));
	if (packs.length === 0) {
		throw new Error('[vercel] fresh-moves-glasses/builds exists but holds no zips');
	}
	fs.mkdirSync(path.join(public_dir, 'download', 'fresh-moves'), {recursive: true});
	for (const pack of packs) {
		fs.copyFileSync(
			path.join(pack_dir, pack),
			path.join(public_dir, 'download', 'fresh-moves', pack)
		);
	}
	console.log(`[vercel] published ${packs.length} Fresh Moves fix packs`);
} else {
	throw new Error('[vercel] fresh-moves-glasses/builds is missing; the fix page would have no downloads');
}

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
