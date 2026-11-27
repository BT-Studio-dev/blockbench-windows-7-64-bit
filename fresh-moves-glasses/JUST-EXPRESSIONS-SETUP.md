## What was actually wrong

Just Expressions places its eyebrow overlay planes at z=-4.501. The vanilla
hat layer, which is where a player's skin glasses live, renders at z=-4.500.
That is a separation of 0.001 units, far below what the depth buffer can
resolve, so which surface wins changes with camera angle. That is the
"flickering from specific angles only" reported as Just Expressions issue #5,
and it is why the flecks wander as you move rather than sitting still.

```
head face       -4.000
brows_overlay   -4.501   <- 0.001 in front of the hat plane
hat / glasses   -4.500
```

The fix moves the eight brow overlay planes to **-4.250**, midway between the
face at -4.000 and the hat at -4.500, giving 0.25 units of clearance on both
sides. The hat layer is **not** touched: its geometry and inflate stay exactly
vanilla, because the hat layer is your glasses and moving it hides or scales
them.

## What a previous version of this pack got wrong

It raised the hat layer's inflate from 0.5 to 1.6. OptiFine's inflate expands
on **both** sides, so that put the hat front at -5.600 and grew the layer from
9.0 to 11.2 units, 24 percent too large, in front of the player's own glasses.
`scripts/verify_packs.mjs` now fails the build if the hat layer leaves the
vanilla plane or changes size, and if any brow plane sits at or beyond -4.500.

## Which player model loads

EMF reads both folders, and its own `emf_model.txt` says `emf/cem` takes
priority over `optifine/cem`. With both packs installed the player therefore
comes from:

| Pack | Folder | Result |
| --- | --- | --- |
| Just Expressions | `assets/minecraft/emf/cem/` | wins |
| Fresh Moves | `assets/minecraft/optifine/cem/` | overridden |

Fresh Moves' player head, hat layer and eyebrows never load on EMF. Only one
model can own `part: head`, and `emf/cem` is checked first.

## Why the glasses had ragged edges

Measured from the packs themselves:

- Just Expressions brow overlays sit at z = -4.501, as flat planes with depth 0.
- Its `headwear` (the hat layer, where sunglasses are painted) is a box at
  z = -4 with `sizeAdd: 0.5`, so its front face is at -4.250.
- The eyebrows are therefore 0.251 in front of the glasses and are drawn over
  them. EMF moves those eyebrows for facial expressions, so the overlap travels
  and reads as flickering white specks and a broken lens edge.

Fresh Moves had the same fault with different numbers: its brows reach -4.55
while its own headwear front face is at -4.50, a 0.05 overlap.

## What the fix changes

The pack in this folder sets both players' hat layers in front of the eyebrows:

| Path | Change | Front face | Clears brows by |
| --- | --- | --- | --- |
| `emf/cem/player.jem` and `player_slim.jem` | `sizeAdd` 0.5 to 1.6 | -4.800 | 0.299 |
| `optifine/cem/player.jem` and `player_slim.jem` | box grown to -4.75 | -4.750 | 0.200 |

Both paths are present so the pack is correct no matter which one a loader
picks. Verified: 0 of 130 Just Expressions face boxes and 0 of 155 Fresh Moves
head boxes cross their glasses plane.

The margin is deliberately wide. The affected machine renders through
SwiftShader, which has less depth precision than a GPU, so a hairline clearance
would still flicker.

## Required ETF setting, before anything else

Both packs document this and it is off by default. Without it ETF clamps the
skin's alpha channel to fully opaque, which breaks the animated eyes and also
hard-cuts the edges of any transparent layer such as sunglasses.

1. Options > Resource Packs, then the creeper face button for the EMF/ETF menu
2. Textures > Player skin settings
3. Allow skin transparency > **All skins**
4. Back out fully; the pack reloads with the red Mojang screen
5. Restart the game if the eyes still look wrong

Both packs also need EMF 2.0.2+ and ETF 6.0.1+. Remove AlphaSkins and
CustomSkinLoader if present; both are obsolete and cause this.

Try that setting on its own first. If the ragged edges disappear, this patch is
not needed: it treats eyebrow geometry that crosses the lens, which is a
separate fault.

## Install

1. Remove or disable the original Just Expressions and Fresh Moves packs.
2. Put `just-expressions-fresh-moves-glasses-fix.zip` in
   `.minecraft/resourcepacks`.
3. Enable it, with EMF and ETF installed as before.

The 18 vanilla skin textures from Just Expressions are included unchanged, so
the default skins still work.

## Caveat

Raising `sizeAdd` makes the hat layer itself larger: 9.6 units instead of 9.
A hat layer painted edge to edge will project very slightly larger. If the
sunglasses look too big, reduce `sizeAdd` to 1.05, which still clears the
brows by 0.024 but relies on more depth precision.
