const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class Element {
  constructor(id = "") {
    this.id = id; this.listeners = {}; this.attributes = {}; this.children = [];
    this.hidden = false; this.disabled = false; this.checked = false; this.textContent = "";
    this.className = ""; this.value = ""; this.src = ""; this.style = {};
    const classes = new Set();
    this.classList = { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) };
  }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  dispatch(name, event = {}) { this.listeners[name]?.({ preventDefault() {}, target: this, ...event }); }
  click() { this.clicked = true; this.dispatch("click"); }
  append(child) { this.children.push(child); }
  remove() { this.removed = true; }
  removeAttribute(name) { delete this.attributes[name]; if (name === "src") this.src = ""; }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren(...children) { this.children = children; }
  querySelector(selector) {
    if (selector === "span") return this.label ||= new Element();
    if (selector === "path") return this.path ||= new Element("background-path");
    return null;
  }
}

function createApp() {
  const ids = ["fileInput", "dropZone", "selectedFile", "fileThumbnail", "fileName", "fileSize", "removeFileBtn", "convertBtn", "downloadBtn", "statusMessage", "originalImage", "originalEmpty", "vectorPreview", "vectorEmpty", "colorCount", "detailLevel", "smoothing", "noiseRemoval", "outlineThickness", "removeBackground", "batikPresetBtn", "zoomOutBtn", "zoomInBtn", "resetZoomBtn", "zoomLevel", "beforeAfter", "compareOriginal", "compareVector", "compareSlider", "compareDivider"];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
  Object.assign(elements.colorCount, { value: "16" });
  Object.assign(elements.detailLevel, { value: "medium" });
  Object.assign(elements.smoothing, { value: "1" });
  Object.assign(elements.noiseRemoval, { value: "2" });
  Object.assign(elements.outlineThickness, { value: "0" });
  Object.assign(elements.compareSlider, { value: "50" });
  elements.selectedFile.hidden = elements.originalImage.hidden = elements.beforeAfter.hidden = true;
  elements.convertBtn.disabled = elements.downloadBtn.disabled = true;
  let downloadedLink; let revokedUrl; const traceCalls = [];

  class FileReader {
    addEventListener(name, handler) { this[name] = handler; }
    readAsDataURL(file) { this.result = `data:${file.type};base64,MOCK`; this.load(); }
  }
  class DOMParser {
    parseFromString() { const svg = new Element("svg"); svg.nodeName = "svg"; return { documentElement: svg, querySelector: () => null }; }
  }
  class XMLSerializer { serializeToString() { return '<svg role="img"><path/></svg>'; } }
  const rootStyle = { properties: {}, setProperty(name, value) { this.properties[name] = value; } };
  const document = {
    body: new Element("body"), documentElement: { style: rootStyle },
    querySelector: (selector) => elements[selector.slice(1)],
    createElement: () => (downloadedLink = new Element("a")), importNode: (node) => node,
  };
  const context = {
    console, Blob, document, DOMParser, XMLSerializer, FileReader, Set,
    window: {
      ImageTracer: { imageToSVG: (url, done, options) => { traceCalls.push({ url, options }); done('<svg viewBox="0 0 1 1"><path/></svg>'); } },
      setTimeout: (callback) => { callback(); return 1; }, clearTimeout() {},
    },
    URL: { createObjectURL: () => "blob:mock-vector", revokeObjectURL: (url) => { revokedUrl = url; } },
  };
  vm.runInNewContext(fs.readFileSync("script.js", "utf8"), context);
  return { elements, traceCalls, rootStyle, getDownloadedLink: () => downloadedLink, getRevokedUrl: () => revokedUrl };
}

function upload(app, file = { name: "batik-photo.png", type: "image/png", size: 2048 }) {
  app.elements.fileInput.dispatch("change", { target: { files: [file] } });
}

test("accepts a PNG and shows its original preview", () => {
  const app = createApp(); upload(app);
  assert.equal(app.elements.originalImage.src, "data:image/png;base64,MOCK");
  assert.equal(app.elements.compareOriginal.src, "data:image/png;base64,MOCK");
  assert.equal(app.elements.originalImage.hidden, false);
  assert.equal(app.elements.originalEmpty.hidden, true);
  assert.equal(app.elements.convertBtn.disabled, false);
});

test("rejects unsupported files and oversized images", () => {
  const unsupported = createApp(); upload(unsupported, { name: "photo.webp", type: "image/webp", size: 100 });
  assert.match(unsupported.elements.statusMessage.textContent, /JPG or PNG/);
  const oversized = createApp(); upload(oversized, { name: "huge.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 });
  assert.match(oversized.elements.statusMessage.textContent, /larger than 10 MB/);
});

test("Batik preset preserves maximum colors and high path detail", () => {
  const app = createApp(); upload(app); app.elements.batikPresetBtn.click(); app.elements.convertBtn.click();
  const options = app.traceCalls.at(-1).options;
  assert.equal(options.numberofcolors, 32);
  assert.equal(options.ltres, 0.35);
  assert.equal(options.qtres, 0.35);
  assert.equal(options.pathomit, 1);
  assert.equal(options.rightangleenhance, false);
  assert.equal(options.colorquantcycles, 5);
  assert.equal(options.strokewidth, 0.5);
});

test("settings changes automatically update an existing SVG preview", () => {
  const app = createApp(); upload(app); app.elements.convertBtn.click();
  assert.equal(app.traceCalls.length, 1);
  app.elements.colorCount.value = "24";
  app.elements.colorCount.dispatch("change");
  assert.equal(app.traceCalls.length, 2);
  assert.equal(app.traceCalls[1].options.numberofcolors, 24);
  assert.equal(app.elements.beforeAfter.hidden, false);
});

test("background removal, zoom, comparison, and original-name download work", () => {
  const app = createApp(); upload(app, { name: "holiday.photo.jpg", type: "image/jpeg", size: 4096 });
  app.elements.removeBackground.checked = true;
  app.elements.convertBtn.click();
  assert.equal(app.elements.vectorPreview.children[0].path.removed, true);
  app.elements.zoomInBtn.click();
  assert.equal(app.elements.zoomLevel.textContent, "125%");
  assert.equal(app.rootStyle.properties["--preview-zoom"], 1.25);
  app.elements.compareSlider.value = "70"; app.elements.compareSlider.dispatch("input");
  assert.equal(app.elements.compareVector.style.clipPath, "inset(0 0 0 70%)");
  app.elements.downloadBtn.click();
  assert.equal(app.getDownloadedLink().download, "holiday.photo.svg");
  assert.equal(app.getDownloadedLink().clicked, true);
  assert.equal(app.getRevokedUrl(), "blob:mock-vector");
});
