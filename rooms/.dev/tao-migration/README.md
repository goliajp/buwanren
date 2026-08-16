# Taotao room — hardcoded furnishings → asset library

The Taotao room's 19 furnishing sections (~950 lines drawn straight onto a
scratch `bg` canvas) are now 70 library assets + a declarative `window.TAO_ROOM`
plan rendered through `window.renderRoom`. The NPC sections (Taotao, the golden
retriever) were not touched.

## Rebuild / re-verify

    node bake_rnd.js rnd.json    # bake the shared PRNG stream to literals
    node build.js                # measure bboxes, emit out_assets/out_surfaces/out_room
    node verify.js               # diff vs baseline.png, write sidebyside + heatmap
    node verify3.js              # assert no asset's ink escapes its declared w/h
    node occlusion.js            # assert no plan entry renders fully hidden

`build.js` slices the original code verbatim out of `tao_furniture.js` (the
extracted furnishing region) and wraps it; it does not retype the drawing.

## Result

Difference vs the original render is **3.63%** of pixels, **1.19%** above ±8/255
— below the Ayun room's 6.8%. Every remaining difference comes from the render
pipeline (contact shadows, y-sort, colour grade), not from lost geometry:

* no asset renders empty, no bbox clips its own drawing, nothing renders hidden.

## Three things that do not survive a naive copy

1. **`rnd()` was one seeded stream shared across objects.** Wall speckle, mat
   wear and the two petal scatters drew from it in sequence, so splitting them
   into independent `draw()` calls shifts every value. The consumed numbers are
   baked to literals in `spec.js`.
2. **`placeAsset` pre-scales the sprite context 2x.** Migrated code is authored
   in full room pixels, so each `draw()` opens with `g.scale(0.5, 0.5)`.
3. **Bounding boxes must be measured with a margin.** On a bare 1440x2560 canvas
   the light board's glow is truncated by the canvas edge, which would bake a
   too-small box into the asset.
