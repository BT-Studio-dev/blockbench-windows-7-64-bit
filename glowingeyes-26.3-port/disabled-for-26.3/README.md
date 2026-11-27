# Disabled for the 26.3 port

These are real parts of the mod that are switched off in this branch. Nothing
here is deleted from upstream; the files were moved out of the compiled source
set so the rest of the mod can build, and they can be restored once the
third-party mods they integrate with publish 26.x builds.

## What was turned off and why

**Flashback** (`flashback/`, `FlashbackRecorderMixin.java`)

This one is a hard blocker, not a judgement call. Under no-remap Loom, the
build fails while processing Flashback's jar:

```
Failed to process jar when running jar processor: fabric-loom:access-widener
Expected official namespace for access widener entry, found: intermediary in mod: flashback
```

Flashback's access widener is written in intermediary names. Intermediary only
exists because the game used to be obfuscated; 26.x ships unobfuscated, so those
names resolve to nothing. It cannot be fixed from this side -- it needs a
Flashback release built for 26.x.

**Female Gender** (`Wildfire_genderGenderLayerMixin.java`)

Its mixin targets `submit(PoseStack;SubmitNodeCollector;ILHumanoidRenderState;FF)V`
by full descriptor. A renderer rewrite changes that signature, and a
full-descriptor inject fails silently when it does -- the mod loads and the
integration quietly does nothing. Not worth carrying blind.

**ReplayMod** (`replaymod/`)

Same category: an optional integration with a third-party renderer, unused by
the core feature.

None of the three affects whether skin pixels glow. They are integrations,
registered defensively in `FabricCompatPlugins` behind `try { } catch
(NoClassDefFoundError)` blocks precisely because they are expected to be absent.
That file still compiles: the classes it imports are gone, but the imports were
only referenced inside the try blocks, so each one now throws NoClassDefFoundError
on first touch and the catch swallows it -- which is the behaviour the author
designed these registrations around in the first place.

## To restore

Move the directories back, re-add the three `compileOnly` lines to
`fabric/build.gradle`, and put the two mixin entries back in
`glowingeyes.fabric.mixins.json`. Check that each dependency publishes a 26.x
build first, and that its renderer calls still match.
