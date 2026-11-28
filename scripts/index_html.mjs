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

// The loading check at the end of index.html polls for the app, so its tag is
// the same in both builds and nothing needs rewriting here. The check used to
// be an inline script with a defer attribute, but that attribute only applies
// to scripts with a src, so it ran immediately and reported "An error occurred
// while loading Blockbench" before the deferred bundle had even started.
// Guard against that pattern coming back, because it is invisible at runtime
// and only shows up as an error screen on a real machine.
const BROKEN_INLINE_DEFER = /<script\s+defer\s*>/;

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

	if (BROKEN_INLINE_DEFER.test(html)) {
		// index.html was edited or came from an older revision: report it
		// instead of silently producing a build that shows a bogus error box.
		return 'inline-defer';
	}

	fs.writeFileSync(index_path, html, {encoding: 'utf-8'});
	return 'updated';
}
