/**
 * Build the Just Expressions + Fresh Moves glasses fix for every Minecraft
 * Java version, each with a pack.mcmeta its client will accept.
 *
 * Why one pack per version instead of one pack with a wide range: Minecraft
 * replaced `supported_formats` with `min_format`/`max_format` in 1.21.9, and a
 * single file cannot satisfy both eras. Older clients ignore the new keys, and
 * 1.21.9 and newer reject the old key. Writing the correct pair per version is
 * the only way to ship something that enables without a warning on each.
 *
 * Usage: node scripts/build_packs.mjs [outdir]
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), '..');
const source = path.join(root, 'fresh-moves-glasses', 'pack-source');
const out_dir = path.resolve(process.argv[2] ?? path.join(root, 'dist-packs'));

// Resource pack formats per Minecraft version.
// Sources: the Minecraft Wiki pack format table and the 26.x changelogs.
// 69 is the first format that uses min_format/max_format instead of
// supported_formats.
const VERSIONS = [
	['26.3', 97], ['26.2', 88], ['26.1', 84],
	['1.21.11', 75], ['1.21.10', 69], ['1.21.8', 64], ['1.21.7', 64],
	['1.21.6', 63], ['1.21.5', 55], ['1.21.4', 46], ['1.21.3', 42],
	['1.21', 34], ['1.20.1', 15], ['1.19', 9], ['1.18', 8],
	['1.17', 7], ['1.16.5', 6], ['1.15', 5],
];

const MODERN_FORMAT = 69;

const description = version =>
	'\u00A7bJust Expressions + Fresh Moves\u00A7r\n' +
	`\u00A77glasses fix \u00A7f${version}\n\n` +
	'\u00A7eRequired ETF setting:\u00A7r\n' +
	'Textures > Player skin settings\n' +
	'Allow skin transparency > All skins';

if (!fs.existsSync(source)) {
	throw new Error(`[packs] ${source} does not exist`);
}

fs.rmSync(out_dir, {recursive: true, force: true});
fs.mkdirSync(out_dir, {recursive: true});

for (const [version, format] of VERSIONS) {
	const stage = path.join(out_dir, 'work', version);
	fs.cpSync(source, stage, {recursive: true});

	const pack = {
		pack_format: format,
		description: description(version),
	};
	if (format >= MODERN_FORMAT) {
		// 1.21.9 and newer read the pair. 26.3 is format 97.1, so its range
		// ends one minor version above the whole number.
		pack.min_format = [format, 0];
		pack.max_format = version === '26.3' ? [format, 1] : [format, 0];
	} else {
		pack.min_format = format;
		pack.max_format = format;
		// Legacy clients need supported_formats, and it must still contain
		// pack_format. Omitted above 69 because it was removed there.
		pack.supported_formats = [format, format];
	}

	const meta = {pack};
	if (format >= 42) {
		// The 21-2 overlay carries the current face; it must not claim a
		// format newer than the pack around it.
		meta.overlays = {
			entries: [{
				directory: '21-2',
				formats: {min_inclusive: 42, max_inclusive: format},
				min_format: 42,
				max_format: format,
			}],
		};
	}
	fs.writeFileSync(path.join(stage, 'pack.mcmeta'), JSON.stringify(meta, null, 4) + '\n');

	const zip = path.join(out_dir, `JustExpressions-FreshMoves-glasses-${version}.zip`);
	execFileSync('zip', ['-qr', zip, '.'], {cwd: stage});
	const size = fs.statSync(zip).size;
	console.log(`[packs] ${version.padEnd(9)} format=${String(format).padStart(3)}  ${(size / 1024).toFixed(0)} KB`);
}

fs.rmSync(path.join(out_dir, 'work'), {recursive: true, force: true});
console.log(`[packs] wrote ${VERSIONS.length} packs to ${path.relative(root, out_dir)}`);
