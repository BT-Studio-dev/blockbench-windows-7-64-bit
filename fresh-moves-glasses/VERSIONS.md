# Which zip to download

Each pack is built with the `pack_format` its client expects. Using the wrong
one shows "made for an older version" or fails to enable.

| Minecraft | Download |
| --- | --- |
| 26.3 | `JustExpressions-FreshMoves-glasses-26.3.zip` |
| 26.2 | `...-26.2.zip` |
| 26.1, 26.1.x | `...-26.1.zip` |
| 1.21.11 | `...-1.21.11.zip` |
| 1.21.9, 1.21.10 | `...-1.21.10.zip` |
| 1.21.7, 1.21.8 | `...-1.21.8.zip` |
| 1.21.6 | `...-1.21.6.zip` |
| 1.21.5 | `...-1.21.5.zip` |
| 1.21.4 | `...-1.21.4.zip` |
| 1.21.2, 1.21.3 | `...-1.21.3.zip` |
| 1.21, 1.21.1 | `...-1.21.zip` |
| 1.20.x | `...-1.20.1.zip` |
| 1.19.x | `...-1.19.zip` |
| 1.18.x | `...-1.18.zip` |
| 1.17.x | `...-1.17.zip` |
| 1.16.x | `...-1.16.5.zip` |
| 1.15.x | `...-1.15.zip` |

## Why one per version

Minecraft replaced `supported_formats` with `min_format`/`max_format` in
1.21.9, which is pack format 69. A single file cannot satisfy both eras:
older clients ignore the new keys, and 1.21.9 and newer reject the old one.
The build writes the correct pair for each version instead. 26.3 is format
97.1, so its range runs to `[97, 1]`.

## How they are built

`node scripts/build_packs.mjs` reads `pack-source/`, which holds the models
and textures but no `pack.mcmeta`, and writes one zip per version. The
GitHub Actions workflow `Build resource packs` runs it, then re-opens every
zip and fails if any pack is missing its `headwear` fix. Output is attached
to the workflow run as the `just-expressions-fresh-moves-glasses` artifact.
