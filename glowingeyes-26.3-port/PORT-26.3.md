# Porting GlowingEyes to Minecraft 26.3

Started from the `1.21.11` branch (commit `d8d0d02`). Read this before building.

## State

| Step | State |
| --- | --- |
| Toolchain versions | **done** |
| Mixin compatibility level | **done** |
| `fabric.mod.json` version range | **done** |
| CI workflow for JDK 25 | **done** |
| Compile | **not run** — needs CI or a local JDK 25 |
| Source port | **not started** — see below |

## Version numbers, and where they came from

These are not guesses. They are taken from `Tochuuu/Reactions`, a Fabric +
NeoForge mod whose `26.3` branch builds against the same Minecraft version:

```
minecraft_version=26.3
java_version=25
fabric_loader_version=0.19.5
fabric_version=0.161.0+26.3
neoforge_version=26.3.0.6-beta
```

Two consequences worth knowing before you start:

1. **Minecraft 26.x requires Java 25.** Gradle itself must run on JDK 25, not
   only the compiled classes. The wrapper here is already Gradle 9.2.0, which
   supports it.
2. **26.x dropped NeoForm.** `Reactions` builds with
   `dev.architectury.loom-no-remap` and no mappings at all, because the Mojang
   jar is no longer obfuscated. This project still uses the multiloader
   template with `neoFormVersion` in `common/build.gradle`. That path may no
   longer resolve for 26.3.

## The build decision this port defers

`common/build.gradle` sets:

```groovy
neoForge {
    neoFormVersion = neo_form_version
}
```

`neo_form_version` has been **removed from `gradle.properties`** here, because
26.3 does not publish NeoForm artifacts. If the build fails with a missing
`neoFormVersion`, there are two ways out:

- **Keep the multiloader template** and point `common` at a 26.3
  `neoForge.version` instead of a NeoForm version, accepting that `common`
  then compiles against NeoForge's jar rather than vanilla.
- **Migrate to architectury + `loom-no-remap`**, which is what `Reactions`
  does. Larger change: `buildSrc/`, `settings.gradle` and all three
  `build.gradle` files.

The first is smaller and should be tried first.

## Source port: what will break

`1.21.11` already uses the modern render pipeline (`SubmitNodeCollector`,
`AvatarRenderState`, `RenderTypes.eyes`), so the 1.21.9-era restructure is
already absorbed. The remaining risk is concentrated:

| File | Why |
| --- | --- |
| `mixin/client/PlayerRendererMixin.java` | injects a full descriptor: `extractRenderState(Lnet/minecraft/world/entity/Avatar;Lnet/minecraft/client/renderer/entity/state/AvatarRenderState;F)V` |
| `mixin/client/MinecraftMixin.java` | injects a full descriptor: `reloadResourcePacks(ZLnet/minecraft/client/Minecraft$GameLoadCookie;)...` |
| `mixin/client/PlayerRenderStateMixin.java` | mixes into `AvatarRenderState` |
| `client/render/GlowingEyesHeadLayer.java` | `submit(...)`, `getParentModel()`, `RenderTypes.eyes()` |
| `fabric/.../RenderManager.java`, `neoforge/.../RenderManager.java` | both reach into the renderer directly |

Those two full-descriptor injects are the most likely single failure: if a
parameter changes, the mixin silently does not apply and the mod loads but
does nothing — no crash, no error.

`GuiGraphics` is used by 15 files; that API has been stable since 1.20.2, so it
is lower risk.

## Build it in CI

`.github/workflows/build-26.3.yml` compiles on JDK 25 and uploads both jars plus
the build reports on failure. Push to `26.3` or `26.3-dev` and read the log.

Locally:

```bash
export JAVA_HOME=/path/to/jdk-25
./gradlew build --stacktrace
```
