# Vectorly 2 source audit and experiment — 2026-10-12

Reviewed main commit `ed618b81199d2556dbd06fae6634c771f34a50dc`. This identifies the inspected repository version, not the currently deployed website. Deployment parity was not verified.

## Findings grounded in source

`script.js:83–114` changes ImageTracer options; `script.js:152` invokes `window.ImageTracer.imageToSVG` for both modes. Batik High detail uses line/quadratic thresholds .252, more quantization passes, random colorsampling=1, 3 decimal places, disabled linefilter and rightangleenhance. These tune tracing; they do not reconstruct botanical intent. More decimal places do not recover lost geometry.

`script.js:130–133` removes all paths matching the first path fill. This can delete foreground marks sharing the background color; first path is not a verified background. Outline strokes enlarge geometry, so apparent smoothness does not establish shape fidelity. Input byte limits do not bound decoded pixel count. Existing six tests mock ImageTracer and check UI flows, not real vector quality.

| Requirement | Current implementation | Prototype / remaining work |
|---|---|---|
| Smooth Bézier curves | ImageTracer already supports quadratic fitting; it is not just polygon tracing | Cubic fitting with error control; still need tangent continuity, corner classification and intersection tests |
| Shape/proportion | Fits observed pixels including photographic distortion | Approximate contour geometry; no perspective or fabric warp correction |
| Fine interior detail | Blur and path omission can destroy small marks | No global blur; hole handling; tiny/ambiguous marks still require review |
| Accurate colors | Unsupervised quantization may merge intentional colors | Explicit palette with approximate Lab assignment; ICC and close-color tests remain |
| Round circles | Pixel contour curve approximation, no circle recognition | Conservative circle detection, equal-radius arcs; near-circle rejection needs broader tests |
| Closed paths | Can already output closed SVG paths | Explicit Z closure; closure alone does not prove valid topology |
| Layered colors | Colored paths, no app-authored named groups | Four explicit editable groups in test; color groups are not semantic flower/leaf layers |

## Open-source options

ImageTracer fixed `pal` is the cheapest immediate color improvement and should be tried before replacing an engine. The benchmark below shows substantial gains from that alone.

VTracer is a promising alternate baseline: colored clustering, spline fitting and compact SVG; current upstream documentation also describes fixed palettes and seam-free cutout. Those features are version-dependent. It remains an automatic tracer and was researched, not executed here. It does not by itself satisfy motif intent or exact-circle reconstruction.

The implemented OpenCV + MIT fit-curve prototype separates segmentation, shape detection and cubic fitting. No paid model/API or GPU is required. Cost is workstation time, setup and designer review. For production, a human-assisted workflow is more credible than promising automatic manual-quality reconstruction: crop a motif, confirm palette, mark circle candidates, protect fine detail, review geometric controls, export SVG groups.

Potrace can fit clean monochrome outlines but needs separate color masks and overlap/hole logic for this job; GPL licensing needs review if distributed as part of another application. It was not benchmarked. Neural raster-to-vector and generative image cleanup were not used: they can alter motifs and add runtime/model costs.

## Actual executed results

320×320 synthetic flat-color motif, ring holes, ellipses, triangle and circular marks; second fixture adds seeded Gaussian noise (sigma 7) and .4px blur. ImageTracer 1.2.6 uses the actual Batik High Detail option profile with four colors. Random sampling is fixed to one seed for repeatability, not an average over runs. Hybrid and guided baseline receive the known four-color palette, an advantage unavailable automatically on unknown photos.

See `results/metrics.json` for machine-readable measurements and `results/comparison.png` for the original/Batik/hybrid comparison. The additional fixed-palette baseline SVGs are included separately.

| Input / engine | Foreground IoU ↑ | RGB MAE ↓ (0–255) | SVG bytes |
|---|---:|---:|---:|
| Clean / Batik | 0.9745 | 10.638 | 21,942 |
| Clean / ImageTracer fixed palette | 0.9689 | 1.431 | 14,936 |
| Clean / hybrid | 0.9856 | 0.570 | 13,644 |
| Noisy / Batik | 0.9716 | 12.853 | 505,922 |
| Noisy / ImageTracer fixed palette | 0.9678 | 4.647 | 15,064 |
| Noisy / hybrid | 0.9856 | 0.570 | 13,644 |

Hybrid output has 4 color groups, 255 cubic segments, 5 detected circular contours represented by 10 circular arcs, and 21 closed subpaths. This is not a minimal-anchor result. These two inputs happen to segment identically with the known palette; that does not establish general noise robustness. Foreground IoU compares filled silhouettes to clean ground truth and ignores color identity; MAE measures rasterized color error including antialiasing. Neither metric proves fine-detail fidelity or editor usability.

Executed: existing Node suite 6/6 passing; Python quality suite 2/2 passing (clean/noisy reconstruction, circles, layers, holes, selected color samples, transparency and deterministic hybrid output); Python compilation; loopback HTTP conversion returns 200 and expected geometry stats. Comparison PNG visually inspected. Browser upload/download UI has not been exercised in a real browser. Illustrator/CorelDRAW import, real textile photos, self-intersections, smooth tangent continuity and print output are not validated.

## Expected improvements — not yet demonstrated

Designer-confirmed palettes should stabilize print colors; geometric circle constraints should improve selected round marks; explicit groups should speed color editing. Shared boundaries, corner-aware fitting, C1 joins, contour batching and user-confirmed circles should improve production usability but are not implemented. No claimed accuracy percentage applies to customer motifs.

Next acceptance set: 10 real motifs (flowers, leaves, fine dots, touching circles, ring holes, near-circles, similar colors, fabric grain), compare all three methods at identical resolution, inspect 400–800% and import into the actual production editor. Require preserved motif details, no topology loss, circle errors within an agreed tolerance, editable color groups, and designer sign-off. Only then integrate a browser/WASM engine or desktop helper into the root app.
