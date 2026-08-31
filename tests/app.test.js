const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class Element {
  constructor(id = "") {
    this.id = id;
    this.listeners = {};
    this.classList = { add() {}, remove() {} };
    this.attributes = {};
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.textContent = "";
    this.className = "";
    this.value = "";
    this.src = "";
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
    return null;
  }
}

function createApp() {
  const ids = ["fileInput", "dropZone", "selectedFile", "fileThumbnail", "fileName", "fileSize", "removeFileBtn", "convertBtn", "downloadBtn", "statusMessage", "originalImage", "originalEmpty", "vectorPreview", "vectorEmpty"];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
  elements.selectedFile.hidden = true;
  elements.originalImage.hidden = true;
  elements.convertBtn.disabled = true;
  elements.downloadBtn.disabled = true;
  let downloadedLink;
  let revokedUrl;

  class FileReader {
    addEventListener(name, handler) { this[name] = handler; }
    readAsDataURL(file) {
      this.result = `data:${file.type};base64,MOCK`;
      this.load();
    }
  }

  class DOMParser {
    parseFromString() {
      const svg = new Element("svg");
      svg.nodeName = "svg";
      return { documentElement: svg, querySelector: () => null };
    }
  }

  const document = {
    body: new Element("body"),
    querySelector: (selector) => elements[selector.slice(1)],
    createElement: () => (downloadedLink = new Element("a")),
    importNode: (node) => node,
  };
  const context = {
    console,
    Blob,
    document,
    DOMParser,
    FileReader,
    Set,
    window: {
      ImageTracer: { imageToSVG: (_url, done) => done('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>') },
      setTimeout: (callback) => callback(),
    },
    URL: {
      createObjectURL: () => "blob:mock-vector",
      revokeObjectURL: (url) => { revokedUrl = url; },
    },
  };
  vm.runInNewContext(fs.readFileSync("script.js", "utf8"), context);
  return { elements, getDownloadedLink: () => downloadedLink, getRevokedUrl: () => revokedUrl };
}

test("accepts a PNG and shows its original preview", () => {
  const app = createApp();
  const file = { name: "my-photo.png", type: "image/png", size: 2048 };
  app.elements.fileInput.dispatch("change", { target: { files: [file] } });

  assert.equal(app.elements.originalImage.src, "data:image/png;base64,MOCK");
  assert.equal(app.elements.originalImage.hidden, false);
  assert.equal(app.elements.originalEmpty.hidden, true);
  assert.equal(app.elements.fileName.textContent, "my-photo.png");
  assert.equal(app.elements.convertBtn.disabled, false);
});

test("rejects unsupported files and oversized images", () => {
  const unsupported = createApp();
  unsupported.elements.fileInput.dispatch("change", { target: { files: [{ name: "photo.webp", type: "image/webp", size: 100 }] } });
  assert.match(unsupported.elements.statusMessage.textContent, /JPG or PNG/);
  assert.equal(unsupported.elements.convertBtn.disabled, true);

  const oversized = createApp();
  oversized.elements.fileInput.dispatch("change", { target: { files: [{ name: "huge.jpg", type: "image/jpeg", size: 11 * 1024 * 1024 }] } });
  assert.match(oversized.elements.statusMessage.textContent, /larger than 10 MB/);
});

test("converts the selected image, previews the SVG, and downloads it", () => {
  const app = createApp();
  app.elements.fileInput.dispatch("change", { target: { files: [{ name: "holiday.photo.jpg", type: "image/jpeg", size: 4096 }] } });
  app.elements.convertBtn.click();

  assert.equal(app.elements.vectorPreview.children[0].nodeName, "svg");
  assert.equal(app.elements.downloadBtn.disabled, false);
  assert.match(app.elements.statusMessage.textContent, /ready to download/);

  app.elements.downloadBtn.click();
  assert.equal(app.getDownloadedLink().download, "holiday.photo-vector.svg");
  assert.equal(app.getDownloadedLink().href, "blob:mock-vector");
  assert.equal(app.getDownloadedLink().clicked, true);
  assert.equal(app.getRevokedUrl(), "blob:mock-vector");
  assert.match(app.elements.statusMessage.textContent, /downloaded successfully/);
});
