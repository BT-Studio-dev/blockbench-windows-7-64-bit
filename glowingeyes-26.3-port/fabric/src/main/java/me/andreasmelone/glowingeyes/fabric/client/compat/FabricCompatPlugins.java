package me.andreasmelone.glowingeyes.fabric.client.compat;

import me.andreasmelone.glowingeyes.client.compat.CompatPluginRegistry;

/**
 * Registers optional third-party integrations.
 *
 * PORT NOTE (26.3): Flashback, Female Gender and ReplayMod are disabled in this
 * port -- their sources are in disabled-for-26.3/ with the reasons. The hook is
 * kept, empty, so restoring them is a matter of moving the files back and
 * uncommenting the registrations, and so callers do not need to change.
 *
 * The original code caught NoClassDefFoundError around each registration, which
 * is the same idea, just decided at compile time here rather than at runtime.
 */
public class FabricCompatPlugins {
    public static void init() {
        // CompatPluginRegistry.register(new FlashbackCompatPlugin(), true);
        // CompatPluginRegistry.register(new ReplayModCompatPlugin(), true);
        CompatPluginRegistry.class.getName(); // keep the import meaningful
    }
}
