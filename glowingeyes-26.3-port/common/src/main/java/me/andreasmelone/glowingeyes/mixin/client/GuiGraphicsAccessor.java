package me.andreasmelone.glowingeyes.mixin.client;

import com.mojang.renderpearl.api.pipeline.RenderPipeline;
import net.minecraft.client.gui.GuiGraphicsExtractorExtractor;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

@Mixin(GuiGraphicsExtractor.class)
public interface GuiGraphicsExtractorAccessor {
    @Invoker
    void invokeInnerBlit(RenderPipeline pipeline, Identifier atlas, int x0, int x1, int y0, int y1, float u0, float u1, float v0, float v1, int color);
}