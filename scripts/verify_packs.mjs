/**
 * Verify the packs in a directory are built the way the fix requires.
 *
 * The fix moves Just Expressions' eyebrow overlay planes off the hat layer
 * plane. It must NOT resize the hat layer: the hat layer is where a player's
 * skin glasses live, and inflating it hides them or scales them 24 percent.
 *
 * Exit code is non zero on any failure so CI stops.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

const dir = path.resolve(process.argv[2] ?? 'dist-packs');
// Vanilla hat layer front plane, and the plane the brows must sit behind it by.
const HAT_PLANE = -4.5;
const MAX_BROW_Z = -4.5;      // brows must be strictly behind this
const MIN_BROW_Z = -4.0;      // ...and strictly in front of the face

/** Frontmost z of every box in a CEM part, flattened. */
function frontPlanes(model) {
	const out = [];
	const walk = (node, offset_z) => {
		const translate = node.translate ?? [0, 0, 0];
		const z = offset_z + translate[2];
		for (const box of node.boxes ?? []) {
			out.push({id: node.id ?? '', z: box.coordinates[2] + z});
		}
		for (const sub of node.submodels ?? []) {
			if (sub && typeof sub === 'object') walk(sub, z);
		}
	};
	walk(model, 0);
	return out;
}

const zips = fs.readdirSync(dir).filter(f => f.endsWith('.zip'));
if (zips.length === 0) {
	console.error('[verify] no packs found in ' + dir);
	process.exit(1);
}

const problems = [];
for (const zip of zips) {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-'));
	execFileSync('unzip', ['-q', path.join(dir, zip), '-d', tmp]);

	let meta;
	try {
		meta = JSON.parse(fs.readFileSync(path.join(tmp, 'pack.mcmeta'), 'utf8'));
	} catch (err) {
		problems.push(`${zip}: pack.mcmeta does not parse`);
		continue;
	}
	if (!meta.pack?.pack_format) problems.push(`${zip}: no pack_format`);

	for (const jem of ['player.jem', 'player_slim.jem']) {
		const file = path.join(tmp, 'assets/minecraft/emf/cem', jem);
		if (!fs.existsSync(file)) {
			problems.push(`${zip}: missing ${jem}`);
			continue;
		}
		const model = JSON.parse(fs.readFileSync(file, 'utf8'));
		if ((model.models ?? []).length !== 13) {
			problems.push(`${zip}: ${jem} has ${model.models?.length} models, expected 13`);
		}
		const hat = (model.models ?? []).find(m => m.id === 'headwear');
		if (!hat) {
			problems.push(`${zip}: no headwear in ${jem}`);
			continue;
		}
		const box = hat.boxes[0];
		const inflate = box.sizeAdd ?? 0;
		const front = box.coordinates[2] - inflate;
		if (Math.abs(front - HAT_PLANE) > 0.001) {
			problems.push(`${zip}: ${jem} hat layer at ${front}, must stay at ${HAT_PLANE}; inflating it hides the player's skin glasses`);
		}
		if ((box.coordinates[5] + 2 * inflate) !== 9) {
			problems.push(`${zip}: ${jem} hat layer is ${box.coordinates[5] + 2 * inflate} wide, vanilla is 9`);
		}
	}

	// Both copies of the face: base path and the 21-2 overlay that wins on 1.21.2+.
	for (const rel of ['assets/minecraft/emf/cem/player_face.jpm',
	                   '21-2/assets/minecraft/emf/cem/player_face.jpm']) {
		const file = path.join(tmp, rel);
		if (!fs.existsSync(file)) {
			if (rel.startsWith('21-2')) continue;   // overlay is optional below format 42
			problems.push(`${zip}: missing ${rel}`);
			continue;
		}
		const planes = frontPlanes(JSON.parse(fs.readFileSync(file, 'utf8')));
		const brows = planes.filter(p => p.id.includes('brows_overlay'));
		if (brows.length !== 8) {
			problems.push(`${zip}: ${rel} has ${brows.length} brow overlays, expected 8`);
		}
		for (const brow of brows) {
			if (brow.z <= MAX_BROW_Z) {
				problems.push(`${zip}: ${rel} brow at ${brow.z.toFixed(3)} sits on the hat plane ${HAT_PLANE}, will z-fight with skin glasses`);
			}
			if (brow.z >= MIN_BROW_Z) {
				problems.push(`${zip}: ${rel} brow at ${brow.z.toFixed(3)} is inside the face plane ${MIN_BROW_Z}`);
			}
		}
	}
}

if (problems.length) {
	for (const p of problems) console.error('[verify] ' + p);
	console.error(`[verify] ${problems.length} problem(s) across ${zips.length} packs`);
	process.exit(1);
}
console.log(`[verify] ${zips.length} packs OK: hat layer vanilla, brows clear of it`);
