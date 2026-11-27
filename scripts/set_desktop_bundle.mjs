import { useBundle } from './index_html.mjs';
/**
 * Prepare index.html for the desktop build (see scripts/index_html.mjs).
 */
const result = useBundle('desktop');
if (result == 'error') {
	console.error('[set-desktop-bundle] Could not find the bundle script tag in index.html');
	process.exit(1);
}
console.log('[set-desktop-bundle] index.html ' + (result == 'already' ? 'already loads' : 'now loads') + ' dist/bundle.electron.js');
