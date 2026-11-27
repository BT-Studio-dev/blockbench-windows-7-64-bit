import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Utility that switches the script tag in index.html between the web bundle
 * (an ES module, `dist/bundle.js`) and the desktop bundle (a classic script,
 * `dist/bundle.electron.js`).
 *
 * Chromium requests ES modules with CORS, and a page that is opened from a
 * local file has the opaque origin `null`, so `<script type="module">` tags do
 * not work in the desktop app. The desktop bundle is a classic script, so it
 * needs the `defer` attribute to keep running after the document has been
 * parsed, exactly like a module script does.
 */

// fileURLToPath, not new URL(...).pathname: on Windows the latter yields
// "/D:/a/..." and path.resolve turns that into "\D:\a\...", which is not a
// valid path and made the build fail on Windows runners.
const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), '..');
const index_path = path.join(root, 'index.html');

const WEB_BUNDLE = '\t<script type="module" src="dist/bundle.js"></script>';
const DESKTOP_BUNDLE = [
	'\t<!-- Desktop build: loaded as a classic script instead of an ES module, because module',
	'scripts are requested with CORS and fail for local files. `defer` keeps it running after',
	'the document has been parsed, just like the module script in the web build. -->',
	'\t<script defer src="dist/bundle.electron.js"></script>',
].join('\r\n');

const CHECK_MODULE = '\t<script type="module">\r\n\t\tlet browser_check_passed';
const CHECK_DEFERRED = '\t<script defer>\r\n\t\tlet browser_check_passed';

export function useBundle(kind) {
	let html = fs.readFileSync(index_path, {encoding: 'utf-8'});

	if (kind == 'desktop') {
		if (html.includes(DESKTOP_BUNDLE)) return 'already';
		if (!html.includes(WEB_BUNDLE)) return 'error';
		html = html.replace(WEB_BUNDLE, DESKTOP_BUNDLE);
	}
	if (kind == 'web') {
		if (html.includes(WEB_BUNDLE)) return 'already';
		if (!html.includes(DESKTOP_BUNDLE)) return 'error';
		html = html.replace(DESKTOP_BUNDLE, WEB_BUNDLE);
	}

	// The browser compatibility check must run after the app has started.
	// Module scripts are deferred, classic scripts are not, so the check
	// script needs `defer` in the desktop build and its module type back in
	// the web build.
	if (kind == 'desktop') {
		html = html.replace(CHECK_MODULE, CHECK_DEFERRED);
	} else {
		html = html.replace(CHECK_DEFERRED, CHECK_MODULE);
	}

	fs.writeFileSync(index_path, html, {encoding: 'utf-8'});
	return 'updated';
}
