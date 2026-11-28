import { useBundle } from './index_html.mjs';
/**
 * Prepare index.html for the desktop build (see scripts/index_html.mjs).
 */
const result = useBundle('desktop');
if (result == 'inline-defer') {
	console.error('[set-desktop-bundle] index.html has an inline <script defer> loading check. That runs before the app bundle and shows a false loading error, so remove the defer attribute.');
	process.exit(1);
}
if (result == 'error') {
	console.error('[set-desktop-bundle] Could not find the bundle script tag in index.html');
	process.exit(1);
}
console.log('[set-desktop-bundle] index.html ' + (result == 'already' ? 'already loads' : 'now loads') + ' dist/bundle.electron.js');
