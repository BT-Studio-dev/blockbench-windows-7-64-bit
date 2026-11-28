package me.andreasmelone.glowingeyes.client.render;

import com.mojang.renderpearl.api.pipeline.BlendFunction;
import com.mojang.renderpearl.api.pipeline.RenderPipeline;
import com.mojang.renderpearl.api.pipeline.ColorTargetState;
import com.mojang.renderpearl.api.pipeline.PrimitiveTopology;
import net.minecraft.client.renderer.BindGroupLayouts;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.renderpearl.api.vertex.VertexFormat;
import me.andreasmelone.glowingeyes.GlowingEyes;
import me.andreasmelone.glowingeyes.common.util.Util;
import net.minecraft.client.renderer.RenderPipelines;

import java.util.function.Consumer;

public class PipelineManager {
    public static final RenderPipeline.Snippet COLOR_SQUARE_SNIPPET = RenderPipeline.builder(RenderPipelines.GUI_TEXTURED_SNIPPET)
            .withVertexShader(Util.id(GlowingEyes.MOD_ID, "core/color_square"))
            .withFragmentShader(Util.id(GlowingEyes.MOD_ID, "core/color_square"))
            .withColorTargetState(new ColorTargetState(BlendFunction.TRANSLUCENT))
            .withVertexBinding(0, DefaultVertexFormat.POSITION_TEX_COLOR)
            .withPrimitiveTopology(PrimitiveTopology.QUADS)
            // 26.3 builds pipelines from explicit bind groups; GUI drawing needs
            // the globals and projection transforms.
            .withBindGroupLayout(BindGroupLayouts.GLOBALS)
            .withBindGroupLayout(BindGroupLayouts.PROJECTION)
            .withBindGroupLayout(BindGroupLayouts.DYNAMIC_TRANSFORMS)
            .buildSnippet();

    public static final RenderPipeline.Snippet HUE_BAR_SNIPPET = RenderPipeline.builder(RenderPipelines.GUI_TEXTURED_SNIPPET)
            .withVertexShader(Util.id(GlowingEyes.MOD_ID, "core/hue_bar"))
            .withFragmentShader(Util.id(GlowingEyes.MOD_ID, "core/hue_bar"))
            .withColorTargetState(new ColorTargetState(BlendFunction.TRANSLUCENT))
            .withVertexBinding(0, DefaultVertexFormat.POSITION_TEX_COLOR)
            .withPrimitiveTopology(PrimitiveTopology.QUADS)
            // 26.3 builds pipelines from explicit bind groups; GUI drawing needs
            // the globals and projection transforms.
            .withBindGroupLayout(BindGroupLayouts.GLOBALS)
            .withBindGroupLayout(BindGroupLayouts.PROJECTION)
            .withBindGroupLayout(BindGroupLayouts.DYNAMIC_TRANSFORMS)
            .buildSnippet();

    public static final RenderPipeline COLOR_SQUARE_SHADER =
            RenderPipeline.builder(COLOR_SQUARE_SNIPPET)
                    .withLocation(Util.id(GlowingEyes.MOD_ID, "pipeline/color_square"))
                    .build();

    public static final RenderPipeline HUE_BAR_SHADER =
            RenderPipeline.builder(HUE_BAR_SNIPPET)
                    .withLocation(Util.id(GlowingEyes.MOD_ID, "pipeline/hue_bar"))
                    .build();


    public static void register(Consumer<RenderPipeline> registrationCallback) {
        registrationCallback.accept(COLOR_SQUARE_SHADER);
        registrationCallback.accept(HUE_BAR_SHADER);
    }
}
