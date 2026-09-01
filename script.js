"use strict";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_TYPES = new Set(["image/jpeg", "image/png"]);
const DETAIL_OPTIONS = {
  low: { ltres: 2, qtres: 2, pathomit: 12, rightangleenhance: true },
  medium: { ltres: 1, qtres: 1, pathomit: 4, rightangleenhance: true },
  high: { ltres: 0.35, qtres: 0.35, pathomit: 1, rightangleenhance: false },
};

const elements = Object.fromEntries([
  "fileInput", "dropZone", "selectedFile", "fileThumbnail", "fileName", "fileSize",
  "removeFileBtn", "convertBtn", "downloadBtn", "statusMessage", "originalImage",
  "originalEmpty", "vectorPreview", "vectorEmpty", "colorCount", "detailLevel",
  "smoothing", "noiseRemoval", "outlineThickness", "removeBackground", "batikPresetBtn",
  "zoomOutBtn", "zoomInBtn", "resetZoomBtn", "zoomLevel", "beforeAfter",
  "compareOriginal", "compareVector", "compareSlider", "compareDivider",
].map((id) => [id, document.querySelector(`#${id}`)]));

const settingInputs = [elements.colorCount, elements.detailLevel, elements.smoothing,
  elements.noiseRemoval, elements.outlineThickness, elements.removeBackground];
let selectedFile = null;
let imageDataUrl = "";
let svgData = "";
let hasConverted = false;
let conversionTimer = null;
let conversionSequence = 0;
let zoom = 1;

function setStatus(message, type = "") {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status${type ? ` ${type}` : ""}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTraceOptions() {
  const smoothing = Number(elements.smoothing.value);
  const detail = DETAIL_OPTIONS[elements.detailLevel.value];
  return {
    ...detail,
    numberofcolors: Number(elements.colorCount.value),
    colorsampling: 2,
    colorquantcycles: elements.detailLevel.value === "high" ? 5 : 3,
    mincolorratio: elements.detailLevel.value === "high" ? 0 : 0.02,
    linefilter: false,
    blurradius: smoothing,
    blurdelta: smoothing ? 20 : 0,
    pathomit: Math.max(detail.pathomit, Number(elements.noiseRemoval.value)),
    strokewidth: Number(elements.outlineThickness.value),
    scale: 1,
    roundcoords: 2,
    viewbox: true,
    desc: false,
  };
}

function clearVector() {
  svgData = "";
  hasConverted = false;
  elements.downloadBtn.disabled = true;
  elements.vectorPreview.replaceChildren(elements.vectorEmpty);
  elements.vectorEmpty.hidden = false;
  elements.beforeAfter.hidden = true;
  elements.compareVector.replaceChildren();
}

function resetUploader() {
  conversionSequence += 1;
  selectedFile = null;
  imageDataUrl = "";
  elements.fileInput.value = "";
  elements.selectedFile.hidden = true;
  elements.originalImage.removeAttribute("src");
  elements.originalImage.hidden = true;
  elements.originalEmpty.hidden = false;
  elements.convertBtn.disabled = true;
  clearVector();
  setZoom(1);
  setStatus("Choose an image to get started.");
}

function validateFile(file) {
  if (!VALID_TYPES.has(file.type)) return "Please choose a JPG or PNG image.";
  if (file.size > MAX_FILE_SIZE) return "That image is larger than 10 MB. Please choose a smaller file.";
  return "";
}

function loadFile(file) {
  const validationError = validateFile(file);
  if (validationError) {
    elements.fileInput.value = "";
    setStatus(validationError, "error");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    selectedFile = file;
    imageDataUrl = String(reader.result);
    clearVector();
    elements.originalImage.src = imageDataUrl;
    elements.compareOriginal.src = imageDataUrl;
    elements.originalImage.hidden = false;
    elements.originalEmpty.hidden = true;
    elements.fileThumbnail.src = imageDataUrl;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);
    elements.selectedFile.hidden = false;
    elements.convertBtn.disabled = false;
    setStatus("Image ready. Adjust the settings or convert now.", "success");
  });
  reader.addEventListener("error", () => setStatus("We couldn’t read that image. Please try another file.", "error"));
  reader.readAsDataURL(file);
}

function prepareSvg(svg) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  const svgElement = documentNode.documentElement;
  if (svgElement.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) return null;

  if (elements.removeBackground.checked) {
    // ImageTracer writes the quantized background first; removing its first path
    // retains foreground color layers while exposing a transparent SVG canvas.
    const backgroundPath = svgElement.querySelector("path");
    if (backgroundPath) backgroundPath.remove();
  }
  svgElement.setAttribute("role", "img");
  svgElement.setAttribute("aria-label", `Vector version of ${selectedFile.name}`);
  return svgElement;
}

function serializeSvg(svgElement) {
  return new XMLSerializer().serializeToString(svgElement);
}

function finishConversion(svg, sequence) {
  if (sequence !== conversionSequence || !selectedFile) return;
  const svgElement = prepareSvg(svg);
  if (!svgElement) {
    setStatus("The vector result was invalid. Please try another image.", "error");
    elements.convertBtn.disabled = false;
    elements.convertBtn.querySelector("span").textContent = "Convert to vector";
    return;
  }

  svgData = serializeSvg(svgElement);
  const previewSvg = document.importNode(svgElement, true);
  const compareSvg = document.importNode(svgElement, true);
  elements.vectorPreview.replaceChildren(previewSvg);
  elements.compareVector.replaceChildren(compareSvg);
  elements.beforeAfter.hidden = false;
  hasConverted = true;
  elements.downloadBtn.disabled = false;
  elements.convertBtn.disabled = false;
  elements.convertBtn.querySelector("span").textContent = "Convert again";
  updateZoom();
  updateComparison();
  setStatus("Your detailed vector is ready. Settings now update it automatically.", "success");
}

function convertImage() {
  if (!imageDataUrl || !selectedFile) {
    setStatus("Choose a JPG or PNG image first.", "error");
    return;
  }
  if (typeof window.ImageTracer === "undefined") {
    setStatus("The converter could not load. Check your internet connection and refresh the page.", "error");
    return;
  }
  const sequence = ++conversionSequence;
  elements.convertBtn.disabled = true;
  elements.downloadBtn.disabled = true;
  elements.convertBtn.querySelector("span").textContent = "Converting…";
  setStatus("Tracing smooth curves, colors, and small details…");
  window.ImageTracer.imageToSVG(imageDataUrl, (svg) => finishConversion(svg, sequence), getTraceOptions());
}

function scheduleLiveConversion() {
  elements.batikPresetBtn.classList.remove("active");
  elements.batikPresetBtn.textContent = "Apply preset";
  if (!hasConverted) return;
  window.clearTimeout(conversionTimer);
  conversionTimer = window.setTimeout(convertImage, 250);
  setStatus("Updating preview with your new settings…");
}

function applyBatikPreset() {
  elements.colorCount.value = "32";
  elements.detailLevel.value = "high";
  elements.smoothing.value = "1";
  elements.noiseRemoval.value = "0";
  elements.outlineThickness.value = "0.5";
  elements.removeBackground.checked = false;
  elements.batikPresetBtn.classList.add("active");
  elements.batikPresetBtn.textContent = "Preset applied ✓";
  if (hasConverted) convertImage();
  else setStatus("Batik preset applied. Choose an image or select convert.", "success");
}

function updateZoom() {
  elements.zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  document.documentElement.style.setProperty("--preview-zoom", zoom);
}
function setZoom(value) {
  zoom = Math.min(2, Math.max(0.5, value));
  updateZoom();
}
function updateComparison() {
  const position = Number(elements.compareSlider.value);
  elements.compareVector.style.clipPath = `inset(0 0 0 ${position}%)`;
  elements.compareDivider.style.left = `${position}%`;
}

elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.fileInput.click(); }
});
elements.fileInput.addEventListener("change", (event) => { const [file] = event.target.files; if (file) loadFile(file); });
["dragenter", "dragover"].forEach((name) => elements.dropZone.addEventListener(name, (event) => {
  event.preventDefault(); elements.dropZone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((name) => elements.dropZone.addEventListener(name, (event) => {
  event.preventDefault(); elements.dropZone.classList.remove("is-dragging");
}));
elements.dropZone.addEventListener("drop", (event) => { const [file] = event.dataTransfer.files; if (file) loadFile(file); });
elements.removeFileBtn.addEventListener("click", resetUploader);
elements.convertBtn.addEventListener("click", convertImage);
elements.batikPresetBtn.addEventListener("click", applyBatikPreset);
settingInputs.forEach((input) => input.addEventListener("change", scheduleLiveConversion));
elements.zoomOutBtn.addEventListener("click", () => setZoom(zoom - 0.25));
elements.zoomInBtn.addEventListener("click", () => setZoom(zoom + 0.25));
elements.resetZoomBtn.addEventListener("click", () => setZoom(1));
elements.compareSlider.addEventListener("input", updateComparison);

elements.downloadBtn.addEventListener("click", () => {
  if (!svgData || !selectedFile) return;
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const originalName = selectedFile.name.replace(/\.[^.]+$/, "") || "vector-image";
  link.href = url;
  link.download = `${originalName}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("SVG downloaded successfully.", "success");
});
