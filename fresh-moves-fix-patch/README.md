# Glasses fix for Fresh-Moves-Fix

The patch in this folder fixes a real bug in `BT-Studio-dev/Fresh-Moves-Fix`,
but it could not be pushed from this session: the GitHub token available here is
a fine-grained personal access token scoped to `blockbench-windows-7-64-bit`, so
writing to `Fresh-Moves-Fix` returns 403.

## The bug

`right_brow5`-`8` and `left_brow5`-`8`, the 2nd-layer eyebrow variants, sit at
z `-4.550`. The hat layer is at `-4.500`. A player's sunglasses are drawn on the
hat layer, so those eyebrows render over the lens, and the 0.05 gap also lets
the two surfaces swap depth as the camera turns. That is the flicker reported as
glasses glitching, and it matches Just Expressions issue #5, where that pack's
face overlays sit one thousandth of a unit in front of the same plane.

## The fix

Those eight boxes move to `-4.350`: 0.15 behind the hat layer, 0.35 in front of
the face. An opaque lens hides them; a transparent one still lets them through.
The hat layer itself is not touched, because it holds the glasses.

Both `player.jem` and `player_slim.jem` are patched, in `assets/` and in the
`v1_21_2/` overlay that loads on 1.21.2 and newer.

## Apply it

```
git clone https://github.com/BT-Studio-dev/Fresh-Moves-Fix.git
cd Fresh-Moves-Fix
git checkout -b glasses-fix
git am /path/to/0001-glasses-fix.patch
python3 build.py
git push -u origin glasses-fix
```

then open a pull request. `git apply --check` was run against a fresh clone of
`main` and the patch applies cleanly.

## What it contains

- the 32 box edits, eight per file across four files
- `build.py`: a check that fails if any eyebrow box is at or in front of the hat
  plane, or if the hat layer leaves `-4.500`, across `assets/` and every overlay
- `docs/Fix-Glasses-Over-Eyebrows.md`, which the site turns into
  `/guides/fix-glasses-over-eyebrows/` automatically
- a line in the README changelog

## Verified before writing the patch

- `python3 build.py` passes and writes 26 zips
- all 26 zips scanned: 448 2nd-layer brow boxes, every one at `-4.35`, none in
  front of the hat plane
- the hat layer is still `-4.500` with size 9 in every file
- the new check fails on the unpatched model, so it is known to bite
