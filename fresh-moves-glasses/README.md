# Fresh Moves glasses fix

Fixes the ragged white flecks and jagged lens edge that appear when a player
skin with sunglasses on the hat layer is used with the Fresh Moves pack.

## The cause

Measured from `player.jem` in Fresh Moves v3.1.1:

- The glasses live on `headwear`, a single box spanning z = -4.5 .. 4.5.
- The animated `head` model has 155 boxes. Eight of them, the eyebrows
  `right_brow5..8` and `left_brow5..8`, reach z = -4.55.
- The eyebrows therefore sit 0.05 units in front of the glasses lens, so they
  are drawn over it. Because the brows move during the pack's facial
  animations, the overlap shifts from frame to frame, which reads as flickering
  white specks and a broken edge along the lens.

This is geometry, not texture filtering. Adjusting the skin cannot fix it.

## The fix

The `headwear` cube grows by 0.25 on every side, moving its front face from
-4.5 to -4.75. The eyebrows now clear the lens by 0.20 units and are hidden
behind the glasses as intended. It grows on all sides to stay centred, so the
glasses do not shift. All six UV faces are unchanged, so the hat layer texture
still maps the same way.

## Install

1. Delete or disable the original Fresh Moves pack.
2. Put `fresh-moves-glasses-fix.zip` in `.minecraft/resourcepacks`.
3. Enable it. It still needs EMF and ETF, or OptiFine, like the original.

`player_slim.jem` is included unchanged from the original pack so slim skins
keep their animations.
