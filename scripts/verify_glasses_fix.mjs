#!/usr/bin/env node
// Guard that the built packs carry Fresh Moves' own brow geometry, unmodified.
//
// Filename note: this is still verify_glasses_fix.mjs because the CI workflow and
// the README reference it, but it no longer checks a fix -- there is no fix. It
// pins the upstream values so an accidental edit fails CI.
//
// History, because it matters: this check used to assert a "fix" that moved
// right_brow5-8 to 0.05 and left_brow5-8 to -0.35. In game that produced solid
// bars standing off the face -- the eyebrows in this model are 0.25 deep, so
// translating them about moves a slab, it does not close a coplanar gap. The
// edit has been reverted and the packs now ship the author's original numbers.
//
// So this asserts the ORIGINAL values, per box, read out of the built zips. If a
// future edit moves them, CI fails rather than shipping it.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
// Accept a directory so CI can point this at dist-packs/ as well as the
// checked-in builds/ -- they should agree, and checking an arbitrary output
// directory is the only way to prove a build job produced the fix.
const builds = process.argv[2]
	? path.resolve(process.argv[2])
	: path.join(root, 'fresh-moves-glasses', 'builds');

// The values Fresh Moves ships. Right and left are deliberately different --
// they compensate for the mirrored translate on the left, and are not a typo.
const EXPECT = {
	right_brow5: -0.15, right_brow6: -0.15, right_brow7: -0.15, right_brow8: -0.15,
	left_brow5: -0.55, left_brow6: -0.55, left_brow7: -0.55, left_brow8: -0.55,
};
// brow9 must NOT move: it is a different row and already correct.
const UNTOUCHED = { right_brow9: -0.15, left_brow9: -0.15 };

// Minimal ZIP reader -- inflate the one file we care about without a dependency.
function readZipEntry(buf, want) {
	let eocd = -1;
	for (let i = buf.length - 22; i >= 0; i--) {
		if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
	}
	if (eocd < 0) throw new Error('not a zip');
	const count = buf.readUInt16LE(eocd + 10);
	let off = buf.readUInt32LE(eocd + 16);
	for (let n = 0; n < count; n++) {
		if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central directory');
		const method = buf.readUInt16LE(off + 10);
		const compSize = buf.readUInt32LE(off + 20);
		const nameLen = buf.readUInt16LE(off + 28);
		const extraLen = buf.readUInt16LE(off + 30);
		const commentLen = buf.readUInt16LE(off + 32);
		const localOff = buf.readUInt32LE(off + 42);
		const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
		if (name === want) {
			const lNameLen = buf.readUInt16LE(localOff + 26);
			const lExtraLen = buf.readUInt16LE(localOff + 28);
			const start = localOff + 30 + lNameLen + lExtraLen;
			const data = buf.subarray(start, start + compSize);
			return method === 0 ? data : zlib.inflateRawSync(data);
		}
		off += 46 + nameLen + extraLen + commentLen;
	}
	return null;
}

function browBoxes(jem) {
	const found = {};
	(function walk(node) {
		if (Array.isArray(node)) return node.forEach(walk);
		if (!node || typeof node !== 'object') return;
		if (typeof node.id === 'string' && EXPECT[node.id] !== undefined || UNTOUCHED[node.id] !== undefined) {
			const boxes = node.boxes || [];
			found[node.id] = boxes.map(b => (b.coordinates || [])[2]);
		}
		Object.values(node).forEach(walk);
	})(jem);
	return found;
}

const zips = fs.readdirSync(builds).filter(f => f.endsWith('.zip')).sort();
if (!zips.length) {
	console.error('[glasses-fix] no builds found');
	process.exit(1);
}

let failed = 0;
for (const file of zips) {
	const version = file.replace(/^.*glasses-/, '').replace(/\.zip$/, '');
	const buf = fs.readFileSync(path.join(builds, file));
	const problems = [];

	for (const jemPath of ['assets/minecraft/optifine/cem/player.jem', 'assets/minecraft/optifine/cem/player_slim.jem']) {
		const raw = readZipEntry(buf, jemPath);
		if (!raw) { problems.push(`${jemPath} missing`); continue; }
		const boxes = browBoxes(JSON.parse(raw.toString('utf8')));
		for (const [id, want] of Object.entries(EXPECT)) {
			const got = boxes[id];
			if (!got) { problems.push(`${id} not found`); continue; }
			if (!got.length) { problems.push(`${id} has no boxes`); continue; }
			for (const z of got) {
				if (z !== want) problems.push(`${id} z=${z} (want ${want})`);
			}
		}
		for (const [id, want] of Object.entries(UNTOUCHED)) {
			for (const z of (boxes[id] || [])) {
				if (z !== want) problems.push(`${id} MOVED z=${z} (want ${want})`);
			}
		}
	}

	if (problems.length) {
		failed++;
		console.error(`[glasses-fix] ${version}: ${problems.slice(0, 4).join('; ')}${problems.length > 4 ? ` (+${problems.length - 4})` : ''}`);
	}
}

if (failed) {
	console.error(`[glasses-fix] FAILED: ${failed} of ${zips.length} packs do not match Fresh Moves upstream`);
	process.exit(1);
}
console.log(`[glasses-fix] OK: all ${zips.length} packs carry unmodified brow geometry (right 5-8 at -0.15, left 5-8 at -0.55)`);
