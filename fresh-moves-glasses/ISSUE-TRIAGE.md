# Fresh-Moves: what is actually missing

Measured against `IthanMendoza/Fresh-Moves` on 2026-11-27. Numbers are counts of
the 312 open issues, not impressions.

## The build stopped, the issues did not

| Signal | Value |
| --- | --- |
| Last commit on `main` | **2025-01-20** — "Add files via upload" |
| Only branch | `main` |
| Open issues | **312** |
| Opened in 2026 | **52** |
| Open issues with **zero** replies | **156** |
| Wiki last edited | **2024-04-30** |

The pack's own `pack.mcmeta` still says, in its description string:

```
"☑ With Animated Eyes
❖ For 1.21.2 and below"
```

and declares `pack_format: 15` with `supported_formats: [0, 99]`.

So the distributable is labelled **1.21.2 and below** and has not been touched in
ten months, while people keep filing for 1.21.9, 1.21.11 and 26.x. That label is
the "build update" that is missing: not a new feature, a release.

## Where the 312 land

Counted by title, so these overlap and do not sum to 312:

| Bucket | Count |
| --- | --- |
| Eye size / position / layout requests (`3x2 eyes`, `cyclops`, `further apart`) | **93** |
| "Please add" / compatibility requests | **51** |
| Bug-shaped (`black`, `broken`, `doesn't work`, `invisible`, `missing`) | **55** |
| Question-shaped (`how`, `why`, `can I`) | **20** |

The single largest bucket is **new eye layouts**, and it grows weekly — #433,
#434, #432, #423, #422 are all from the last few weeks. That is not a bug queue,
it is a feature backlog nobody is serving.

## What is already fixed and has no issue

The glasses/hat z-fight — second-layer brows sitting 0.4 in front of the hat
plane at −4.5, so the brows cut through and flicker against `headwear` — **has no
issue in the tracker**. Nobody filed it. It was found by measurement.

The fix is built and verified: 32 box edits across 4 files, 448 brow boxes
checked, none in front of the hat. 26 per-version builds from 1.15 to 26.3,
including the 26.3 one with `pack_format: 97`.

## What our fix does NOT fix

Honesty matters more here than coverage:

**#344 — "Black Eyes, Can't fix with the fix on the mod page"** (Oct 2025, open,
5 comments). The thread concludes it was caused by **Modrinth's skin store**, not
by the pack. The wiki's Fix Black Eyes page is from May 2024 and does not mention
this. Our pack does not address it; it is a skin-source problem.

**#329 — "glasses on my skin"** (Aug 2025, open, **0 comments**). Describes the
closest thing to our bug in the tracker: glasses on the second layer stop the
fresh eyes animating. Ours is the painted-hat-in-the-model case, not the
skin-layer case, so this is a cousin, not the same file.

**#221, #418** — original-skin pixels showing through the eye model, and eyes
placed under the second layer. Both are skin-mask questions, not geometry
conflicts against `headwear`. Not ours.

**#430 — "impossible time getting these eyes to work"** (Oct 2026, open, 5
comments). Solved in-thread by a user, not by documentation: the answer involved
a "universal mask" and a version 2.0 of Just Expressions that the responder could
not find. Just Expressions' repository shows no releases and no tags, and its
last push was 2025-06-04. If the guide refers to a version that does not exist,
that is a documentation defect worth more than any single pack fix.

## The three fixes, in order of reach

1. **Ship the glasses fix** as a release. It closes a real defect, and the
   per-version builds already exist.
2. **Satisfy the 93 layout requests** in bulk: the requests cluster into a small
   number of shapes (3x2, 3x3, 2x1, cyclops, wider spacing). Each is a variant of
   the same CEM model with different pixel coordinates, which is exactly what the
   existing build script parameterises.
3. **Fix the documentation** so #430-class confusion stops. The wiki describes
   Just Expressions 2.0 and a universal mask that users cannot locate.

None of the three needs anything from upstream.
