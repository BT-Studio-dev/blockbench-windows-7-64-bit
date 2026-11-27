import { useBundle } from './index_html.mjs';
/**
 * Prepare index.html for the web build (see scripts/index_html.mjs).
 */
const result = useBundle('web');
if (result == 'error') {
	console.error('[set-web-bundle] Could not find the bundle script tag in index.html');
	process.exit(1);
}
console.log('[set-web-bundle] index.html ' + (result == 'already' ? 'already loads' : 'now loads') + ' dist/bundle.js');
