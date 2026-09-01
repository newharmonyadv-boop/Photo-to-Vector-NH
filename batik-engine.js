(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.BatikEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const clamp = (value, min = 0, max = 255) => Math.max(min, Math.min(max, value));

  function rgbToLab(red, green, blue) {
    const linear = [red, green, blue].map((value) => {
      const channel = value / 255;
      return channel > 0.04045 ? ((channel + 0.055) / 1.055) ** 2.4 : channel / 12.92;
    });
    const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
    const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
    const pivot = (value) => value > 0.008856 ? Math.cbrt(value) : (7.787 * value) + 16 / 116;
    const fx = pivot(x), fy = pivot(y), fz = pivot(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function labDistance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  function boxAverage(values, width, height, radius) {
    if (!radius) return new Float32Array(values);
    const integral = new Float64Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y += 1) {
      let row = 0;
      for (let x = 0; x < width; x += 1) {
        row += values[y * width + x];
        integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
      }
    }
    const output = new Float32Array(values.length);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius), y0 = Math.max(0, y - radius);
      const x1 = Math.min(width - 1, x + radius), y1 = Math.min(height - 1, y + radius);
      const stride = width + 1;
      const total = integral[(y1 + 1) * stride + x1 + 1] - integral[y0 * stride + x1 + 1] - integral[(y1 + 1) * stride + x0] + integral[y0 * stride + x0];
      output[y * width + x] = total / ((x1 - x0 + 1) * (y1 - y0 + 1));
    }
    return output;
  }

  function preprocess(image, options = {}) {
    const { width, height } = image;
    const source = image.data;
    const luminance = new Float32Array(width * height);
    for (let i = 0; i < luminance.length; i += 1) luminance[i] = source[i * 4] * 0.2126 + source[i * 4 + 1] * 0.7152 + source[i * 4 + 2] * 0.0722;
    const shadowStrength = Number(options.shadowCorrection ?? 55) / 100;
    const lighting = boxAverage(luminance, width, height, Math.max(2, Math.round(Math.min(width, height) / 18)));
    const corrected = new Uint8ClampedArray(source.length);
    for (let i = 0; i < luminance.length; i += 1) {
      const illumination = (128 - lighting[i]) * shadowStrength;
      for (let channel = 0; channel < 3; channel += 1) {
        const balanced = source[i * 4 + channel] + illumination;
        corrected[i * 4 + channel] = clamp((balanced - 128) * 1.08 + 128 + 2);
      }
      corrected[i * 4 + 3] = source[i * 4 + 3];
    }
    const smoothing = Math.max(0, Number(options.edgeSmoothing ?? 2));
    if (!smoothing) return { width, height, data: corrected };
    const result = new Uint8ClampedArray(corrected);
    const radius = Math.min(3, Math.ceil(smoothing / 2));
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const center = (y * width + x) * 4;
      let weights = 0, red = 0, green = 0, blue = 0;
      for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = clamp(x + dx, 0, width - 1), ny = clamp(y + dy, 0, height - 1);
        const offset = (ny * width + nx) * 4;
        const colorDelta = Math.abs(corrected[offset] - corrected[center]) + Math.abs(corrected[offset + 1] - corrected[center + 1]) + Math.abs(corrected[offset + 2] - corrected[center + 2]);
        const weight = colorDelta < 90 + smoothing * 12 ? 1 / (1 + Math.abs(dx) + Math.abs(dy)) : 0;
        weights += weight; red += corrected[offset] * weight; green += corrected[offset + 1] * weight; blue += corrected[offset + 2] * weight;
      }
      result[center] = red / weights; result[center + 1] = green / weights; result[center + 2] = blue / weights;
    }
    return { width, height, data: result };
  }

  function quantize(image, colorCount = 12, iterations = 7) {
    const pixels = [];
    const stride = Math.max(1, Math.floor(Math.sqrt((image.width * image.height) / 25000)));
    for (let y = 0; y < image.height; y += stride) for (let x = 0; x < image.width; x += stride) {
      const offset = (y * image.width + x) * 4;
      pixels.push({ rgb: [image.data[offset], image.data[offset + 1], image.data[offset + 2]], lab: rgbToLab(image.data[offset], image.data[offset + 1], image.data[offset + 2]) });
    }
    pixels.sort((a, b) => a.lab[0] - b.lab[0]);
    let centers = Array.from({ length: colorCount }, (_, index) => pixels[Math.min(pixels.length - 1, Math.floor((index + 0.5) * pixels.length / colorCount))]).map((item) => ({ rgb: [...item.rgb], lab: [...item.lab] }));
    for (let cycle = 0; cycle < iterations; cycle += 1) {
      const sums = centers.map(() => [0, 0, 0, 0]);
      pixels.forEach((pixel) => {
        let best = 0, distance = Infinity;
        centers.forEach((center, index) => { const next = labDistance(pixel.lab, center.lab); if (next < distance) { distance = next; best = index; } });
        sums[best][0] += pixel.rgb[0]; sums[best][1] += pixel.rgb[1]; sums[best][2] += pixel.rgb[2]; sums[best][3] += 1;
      });
      centers = centers.map((center, index) => {
        if (!sums[index][3]) return center;
        const rgb = sums[index].slice(0, 3).map((value) => Math.round(value / sums[index][3]));
        return { rgb, lab: rgbToLab(...rgb) };
      });
    }
    // Collapse clusters that converged to an imperceptibly similar LAB color.
    centers = centers.filter((center, index, list) => !list.slice(0, index).some((previous) => labDistance(previous.lab, center.lab) < 3.2));
    const labels = new Uint16Array(image.width * image.height);
    const usage = new Uint32Array(centers.length);
    for (let i = 0; i < labels.length; i += 1) {
      const lab = rgbToLab(image.data[i * 4], image.data[i * 4 + 1], image.data[i * 4 + 2]);
      let best = 0, distance = Infinity;
      centers.forEach((center, index) => { const next = labDistance(lab, center.lab); if (next < distance) { distance = next; best = index; } });
      labels[i] = best; usage[best] += 1;
    }
    const palette = centers.map((center, index) => ({ rgb: center.rgb, hex: `#${center.rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`, count: usage[index] }));
    return { width: image.width, height: image.height, labels, palette };
  }

  function cleanSegments(segmented, options = {}) {
    const { width, height, palette } = segmented;
    const labels = new Uint16Array(segmented.labels);
    const minimumArea = Math.max(0, Number(options.minimumArea ?? 12));
    const preserveDots = options.preserveDots !== false;
    const visited = new Uint8Array(labels.length);
    const neighbors = (index) => {
      const x = index % width, y = Math.floor(index / width), list = [];
      if (x) list.push(index - 1); if (x + 1 < width) list.push(index + 1);
      if (y) list.push(index - width); if (y + 1 < height) list.push(index + width);
      return list;
    };
    for (let start = 0; start < labels.length; start += 1) {
      if (visited[start]) continue;
      const label = labels[start], queue = [start], region = []; visited[start] = 1;
      while (queue.length) {
        const current = queue.pop(); region.push(current);
        neighbors(current).forEach((next) => { if (!visited[next] && labels[next] === label) { visited[next] = 1; queue.push(next); } });
      }
      const dotFloor = preserveDots ? 1 : minimumArea;
      if (region.length >= dotFloor) continue;
      const votes = new Map();
      region.forEach((index) => neighbors(index).forEach((next) => { if (labels[next] !== label) votes.set(labels[next], (votes.get(labels[next]) || 0) + 1); }));
      let replacement = label, score = -1;
      votes.forEach((count, candidate) => { if (count > score) { score = count; replacement = candidate; } });
      region.forEach((index) => { labels[index] = replacement; });
    }
    const passes = Math.max(0, Number(options.holeFilling ?? 1));
    for (let pass = 0; pass < passes; pass += 1) {
      const next = new Uint16Array(labels);
      for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        const around = [labels[index - 1], labels[index + 1], labels[index - width], labels[index + width]];
        if (around.every((value) => value === around[0]) && labels[index] !== around[0]) next[index] = around[0];
      }
      labels.set(next);
    }
    return { width, height, palette, labels };
  }

  function traceLoops(labels, width, height, target) {
    const edges = new Map();
    const add = (ax, ay, bx, by) => { const key = `${ax},${ay}`; if (!edges.has(key)) edges.set(key, []); edges.get(key).push([bx, by]); };
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (labels[index] !== target) continue;
      if (!y || labels[index - width] !== target) add(x, y, x + 1, y);
      if (x === width - 1 || labels[index + 1] !== target) add(x + 1, y, x + 1, y + 1);
      if (y === height - 1 || labels[index + width] !== target) add(x + 1, y + 1, x, y + 1);
      if (!x || labels[index - 1] !== target) add(x, y + 1, x, y);
    }
    const loops = [];
    while (edges.size) {
      const firstKey = edges.keys().next().value;
      const [sx, sy] = firstKey.split(",").map(Number); const loop = [[sx, sy]];
      let key = firstKey, guard = 0;
      while (edges.has(key) && guard++ < width * height * 8) {
        const choices = edges.get(key), point = choices.pop(); if (!choices.length) edges.delete(key);
        loop.push(point); key = `${point[0]},${point[1]}`; if (key === firstKey) break;
      }
      if (loop.length > 4) loops.push(loop);
    }
    return loops;
  }

  function simplify(points, tolerance) {
    if (points.length < 5 || tolerance <= 0) return points;
    return points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.max(2, Math.round(tolerance + 1)) === 0);
  }

  function layeredSvg(segmented, options = {}) {
    const { width, height, labels, palette } = segmented;
    const smoothing = Number(options.edgeSmoothing ?? 2);
    const groups = palette.map((color, index) => {
      const loops = traceLoops(labels, width, height, index);
      const paths = loops.map((loop) => {
        const points = simplify(loop, smoothing);
        if (!points.length) return "";
        let d = `M${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i += 1) {
          const previous = points[i - 1], current = points[i];
          const mx = (previous[0] + current[0]) / 2, my = (previous[1] + current[1]) / 2;
          d += smoothing ? ` Q${previous[0]} ${previous[1]} ${mx} ${my}` : ` L${current[0]} ${current[1]}`;
        }
        return `${d} Z`;
      }).filter(Boolean).join(" ");
      const name = `color-${String(index + 1).padStart(2, "0")}-${color.hex.slice(1)}`;
      return `<g id="layer-${name}" data-layer-name="${name}" fill="${color.hex}"><path fill-rule="evenodd" d="${paths}"/></g>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>Vectorly Batik Production layered artwork</title>${groups}</svg>`;
  }

  function renderRaster(segmented) {
    const data = new Uint8ClampedArray(segmented.width * segmented.height * 4);
    for (let i = 0; i < segmented.labels.length; i += 1) {
      const rgb = segmented.palette[segmented.labels[i]].rgb;
      data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
    }
    return { width: segmented.width, height: segmented.height, data };
  }

  return { rgbToLab, labDistance, preprocess, quantize, cleanSegments, layeredSvg, renderRaster };
});
