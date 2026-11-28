package me.andreasmelone.glowingeyes.mixin.client;

import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;


/**
 * Clears the dynamic-texture and preset caches after a resource-pack reload.
 *
 * PORT NOTE (26.3): this injected on
 *   reloadResourcePacks(ZLnet/minecraft/client/Minecraft$GameLoadCookie;)...
 * Minecraft$GameLoadCookie no longer exists, and the replacement entry point is
 * not documented by any reference available while porting. The body is kept
 * verbatim below, commented, so the behaviour is not lost -- it just is not
 * wired up yet.
 *
 * Consequence while this is off: after changing resource packs in-game, the
 * cached skin textures and presets are stale until the game restarts. Nothing
 * crashes; it is a reload-convenience regression, and it is the reason this
 * class is left in the tree rather than deleted.
 */
@Mixin(Minecraft.class)
public abstract class MinecraftMixin {
    // private void onReloadResourcePacks(CallbackInfoReturnable<CompletableFuture<Void>> cir) {
    //     cir.getReturnValue().thenApply((unused) -> {
    //         DynamicTextureCache.clear();
    //         PresetManager.getInstance().loadPresets();
    //         return unused;
    //     });
    // }
}
