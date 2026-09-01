const { test } = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../batik-engine.js");

function image(width, height, pixels) {
  return { width, height, data: new Uint8ClampedArray(pixels.flatMap((rgb) => [...rgb, 255])) };
}

test("preprocessing controls correct shadows and preserve dimensions", () => {
  const source = image(3, 1, [[20, 20, 20], [100, 90, 80], [230, 225, 220]]);
  const untouched = Engine.preprocess(source, { shadowCorrection: 0, edgeSmoothing: 0 });
  const corrected = Engine.preprocess(source, { shadowCorrection: 100, edgeSmoothing: 2 });
  assert.equal(corrected.width, 3);
  assert.equal(corrected.height, 1);
  assert.notDeepEqual([...corrected.data], [...untouched.data]);
});

test("extracts the requested perceptual production palette", () => {
  const pixels = Array.from({ length: 64 }, (_, index) => index % 2 ? [185, 35, 30] : [25, 60, 150]);
  const result = Engine.quantize(image(8, 8, pixels), 8, 2);
  assert.ok(result.palette.length >= 2 && result.palette.length <= 8);
  assert.equal(result.labels.length, 64);
  assert.match(result.palette[0].hex, /^#[0-9a-f]{6}$/);
  assert.ok(Engine.labDistance(Engine.rgbToLab(255, 0, 0), Engine.rgbToLab(0, 0, 255)) > 50);
});

test("minimum-area cleanup removes isolated speckles but can preserve decorative dots", () => {
  const segmented = {
    width: 5, height: 5,
    labels: new Uint16Array([0,0,0,0,0, 0,1,0,0,0, 0,0,0,1,0, 0,0,0,0,0, 0,0,0,0,0]),
    palette: [{ hex: "#ffffff", rgb: [255,255,255] }, { hex: "#000000", rgb: [0,0,0] }],
  };
  const removed = Engine.cleanSegments(segmented, { minimumArea: 8, preserveDots: false, holeFilling: 0 });
  const preserved = Engine.cleanSegments(segmented, { minimumArea: 8, preserveDots: true, holeFilling: 0 });
  assert.equal([...removed.labels].filter((label) => label === 1).length, 0);
  assert.equal([...preserved.labels].filter((label) => label === 1).length, 2);
});

test("exports editable color layers with descriptive group IDs and holes", () => {
  const segmented = {
    width: 3, height: 3,
    labels: new Uint16Array([0,0,0, 0,1,0, 0,0,0]),
    palette: [{ hex: "#f0d090", rgb: [240,208,144] }, { hex: "#392010", rgb: [57,32,16] }],
  };
  const svg = Engine.layeredSvg(segmented, { edgeSmoothing: 1 });
  assert.match(svg, /id="layer-color-01-f0d090"/);
  assert.match(svg, /id="layer-color-02-392010"/);
  assert.match(svg, /fill-rule="evenodd"/);
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});
