# NH Motif Geometry Prototype

An isolated experimental lab beside the existing Vectorly 2 app. Root app files are unchanged. No API key, GPU or paid service is needed. Python runs segmentation; Node runs MIT-licensed `fit-curve` cubic fitting. This is automated palette-guided geometric reconstruction, not semantic motif understanding or manual Pen Tool recreation.

## Run on your Mac

From the repository root (Python 3.12 and Node required):

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r prototype/requirements.txt
npm ci --prefix prototype
python3 prototype/server.py
```

Open http://127.0.0.1:8765. Supply 2–32 explicit palette colors including background. Maximum 4 million pixels / 10 MB. This lab uses a loopback Python server and cannot run unchanged on static GitHub Pages. It does not connect to a cloud service. Retain the original image for comparison.

```sh
python3 prototype/reconstruct.py motif.png motif.svg --palette '#ffffff,#183728,#c65d63,#e9b84c' --tolerance 1
python3 prototype/quality_tests.py
node --test
```

The quality script regenerates fixtures, SVGs, comparison image and metrics. Baseline matches root Batik High Detail tolerances with four colors, blur=1 and noise=1; baseline randomness is seeded. A second ImageTracer baseline uses the same supplied palette to isolate palette benefit. Synthetic data and original SVG renders are included; no customer images are included.

## Implementation

1. Convert colors to OpenCV 8-bit Lab; assign pixels to nearest designer palette. This is approximate perceptual distance, not ICC-managed Delta E 2000.
2. Extract each color's contours without global blur or morphological erosion. Alpha below 128 is excluded.
3. For nearly round leaf contours, gate by bounding ratio, radial residual and area; emit equal-radius SVG arcs. This preserves holes using compound paths. Arcs are editable circle geometry, not `<circle>` elements.
4. Split other closed contours into four arcs and fit cubic Béziers via Schneider's algorithm, then close with Z. Four fixed joins are not guaranteed C1 smooth; corners are not yet classified.
5. Group all geometry by exact color; use evenodd fill for holes and nested islands.

No automatic background removal: keep background as an editable layer until a designer verifies removal. Tiny degenerate contours are skipped; fine marks below several pixels require review. Independent contours can produce antialias seams; near-circles can be misclassified. No guarantee against self intersections or topology changes. Fixed palette can erase intentionally similar colors. The current Python implementation starts Node per contour and is unsuitable for dense whole-cloth production without batching.

## Sources / licenses

- ImageTracerJS 1.2.6, Unlicense: https://github.com/jankovicsandras/imagetracerjs
- fit-curve 0.2.0, MIT (keep dependency license): https://github.com/soswow/fit-curve
- OpenCV, Apache 2.0: https://github.com/opencv/opencv
- VTracer candidate, not installed or benchmarked here: https://github.com/visioncortex/vtracer

Dependencies are pinned in lockfile/requirements. The containing repository has no declared license; this prototype does not assign a license to existing project code.
