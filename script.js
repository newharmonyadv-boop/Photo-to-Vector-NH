"use strict";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_TYPES = new Set(["image/jpeg", "image/png"]);

const ids = ["fileInput", "dropZone", "selectedFile", "fileThumbnail", "fileName", "fileSize", "removeFileBtn", "convertBtn", "downloadBtn", "statusMessage", "originalImage", "originalEmpty", "vectorPreview", "vectorEmpty", "settings", "batikPreset", "colorCount", "detailLevel", "smoothing", "smoothingValue", "noiseRemoval", "noiseValue", "outlineThickness", "outlineValue", "removeBackground", "zoomOut", "zoomRange", "zoomValue", "zoomIn", "compareCard", "compareOriginal", "compareAfter", "compareLine", "compareRange", "compareValue"];
const elements = Object.fromEntries(ids.map((id) => [id, document.querySelector(`#${id}`)]));

let selectedFile = null;
let imageDataUrl = "";
let svgData = "";
let hasConverted = false;
let conversionId = 0;
let reconvertTimer = 0;

function setStatus(message, type = "") {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status${type ? ` ${type}` : ""}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clearVector() {
  svgData = "";
  elements.downloadBtn.disabled = true;
  elements.vectorPreview.replaceChildren(elements.vectorEmpty);
  elements.vectorEmpty.hidden = false;
  elements.compareAfter.replaceChildren();
  elements.compareCard.hidden = true;
}

function resetUploader() {
  conversionId += 1;
  selectedFile = null;
  imageDataUrl = "";
  hasConverted = false;
  elements.fileInput.value = "";
  elements.selectedFile.hidden = true;
  elements.originalImage.removeAttribute("src");
  elements.originalImage.hidden = true;
  elements.originalEmpty.hidden = false;
  elements.convertBtn.disabled = true;
  clearVector();
  setStatus("Choose an image to get started.");
}

function validateFile(file) {
  if (!VALID_TYPES.has(file.type)) return "Please choose a JPG or PNG image.";
  if (file.size > MAX_FILE_SIZE) return "That image is larger than 10 MB. Please choose a smaller file.";
  return "";
}

function loadFile(file) {
  const error = validateFile(file);
  if (error) {
    elements.fileInput.value = "";
    setStatus(error, "error");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    selectedFile = file;
    imageDataUrl = String(reader.result);
    hasConverted = false;
    clearVector();
    elements.originalImage.src = imageDataUrl;
    elements.originalImage.hidden = false;
    elements.originalEmpty.hidden = true;
    elements.compareOriginal.src = imageDataUrl;
    elements.fileThumbnail.src = imageDataUrl;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);
    elements.selectedFile.hidden = false;
    elements.convertBtn.disabled = false;
    setStatus("Image ready. Adjust the settings or select “Convert to vector”.", "success");
  });
  reader.addEventListener("error", () => setStatus("We couldn’t read that image. Please try another file.", "error"));
  reader.readAsDataURL(file);
}

function tracingOptions() {
  const detail = elements.detailLevel.value;
  const thresholds = { Low: [3, 3], Medium: [1, 1], High: [0.35, 0.35] };
  const [ltres, qtres] = thresholds[detail];
  return {
    ltres,
    qtres,
    pathomit: Number(elements.noiseRemoval.value),
    numberofcolors: Number(elements.colorCount.value),
    colorsampling: 2,
    colorquantcycles: detail === "High" ? 5 : 3,
    mincolorratio: 0,
    blurradius: Number(elements.smoothing.value),
    blurdelta: 20,
    scale: 1,
    strokewidth: Number(elements.outlineThickness.value),
    linefilter: detail !== "High",
    rightangleenhance: detail === "Low",
    roundcoords: 2,
  };
}

function prepareSvg(svg) {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(svg, "image/svg+xml");
  const svgElement = documentNode.documentElement;
  if (svgElement.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) return null;

  svgElement.setAttribute("role", "img");
  svgElement.setAttribute("aria-label", `Vector version of ${selectedFile.name}`);
  const outline = Number(elements.outlineThickness.value);
  const paths = typeof svgElement.querySelectorAll === "function" ? [...svgElement.querySelectorAll("path")] : [];
  paths.forEach((path) => {
    if (outline) {
      path.setAttribute("stroke", path.getAttribute("fill") || "currentColor");
      path.setAttribute("stroke-width", String(outline));
      path.setAttribute("stroke-linejoin", "round");
    }
  });
  if (elements.removeBackground.checked && paths.length) {
    const firstFill = paths[0].getAttribute("fill");
    paths.filter((path) => path.getAttribute("fill") === firstFill).forEach((path) => path.remove());
  }
  const serialized = typeof XMLSerializer === "function" ? new XMLSerializer().serializeToString(svgElement) : svg;
  return { svgElement, serialized };
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
  const thisConversion = ++conversionId;
  elements.convertBtn.disabled = true;
  elements.convertBtn.querySelector("span").textContent = "Converting…";
  setStatus(hasConverted ? "Updating your vector…" : "Tracing shapes and colors…");
  window.ImageTracer.imageToSVG(imageDataUrl, (svg) => {
    if (thisConversion !== conversionId) return;
    const result = prepareSvg(svg);
    elements.convertBtn.disabled = false;
    elements.convertBtn.querySelector("span").textContent = "Convert again";
    if (!result) {
      setStatus("The vector result was invalid. Please try another image.", "error");
      return;
    }
    svgData = result.serialized;
    elements.vectorPreview.replaceChildren(document.importNode(result.svgElement, true));
    elements.compareAfter.replaceChildren(document.importNode(result.svgElement, true));
    elements.vectorEmpty.hidden = true;
    elements.compareCard.hidden = false;
    elements.downloadBtn.disabled = false;
    hasConverted = true;
    setStatus("Your vector is ready to download!", "success");
    updateZoom();
  }, tracingOptions());
}

function scheduleReconvert() {
  updateSettingOutputs();
  if (!hasConverted) return;
  window.clearTimeout(reconvertTimer);
  reconvertTimer = window.setTimeout(convertImage, 250);
}

function updateSettingOutputs() {
  elements.smoothingValue.textContent = elements.smoothing.value;
  elements.noiseValue.textContent = `${elements.noiseRemoval.value} px`;
  elements.outlineValue.textContent = `${elements.outlineThickness.value} px`;
}

function updateZoom() {
  const zoom = Number(elements.zoomRange.value);
  elements.zoomValue.textContent = `${zoom}%`;
  document.documentElement.style.setProperty("--preview-zoom", zoom / 100);
}

function updateComparison() {
  const position = Number(elements.compareRange.value);
  elements.compareAfter.style.clipPath = `inset(0 ${100 - position}% 0 0)`;
  elements.compareLine.style.left = `${position}%`;
  elements.compareValue.textContent = `${position}% vector`;
}

elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.fileInput.click(); }
});
elements.fileInput.addEventListener("change", (event) => { const [file] = event.target.files; if (file) loadFile(file); });
["dragenter", "dragover"].forEach((name) => elements.dropZone.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.add("is-dragging"); }));
["dragleave", "drop"].forEach((name) => elements.dropZone.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.remove("is-dragging"); }));
elements.dropZone.addEventListener("drop", (event) => { const [file] = event.dataTransfer.files; if (file) loadFile(file); });
elements.removeFileBtn.addEventListener("click", resetUploader);
elements.convertBtn.addEventListener("click", convertImage);

elements.settings.addEventListener("input", scheduleReconvert);
elements.settings.addEventListener("change", scheduleReconvert);
elements.batikPreset.addEventListener("click", () => {
  elements.colorCount.value = "32";
  elements.detailLevel.value = "High";
  elements.smoothing.value = "1";
  elements.noiseRemoval.value = "1";
  elements.outlineThickness.value = "0.5";
  elements.removeBackground.checked = false;
  elements.batikPreset.classList.add("is-active");
  scheduleReconvert();
  setStatus(hasConverted ? "Batik preset applied. Updating your vector…" : "Batik High Detail preset applied.", "success");
});

elements.zoomRange.addEventListener("input", updateZoom);
elements.zoomOut.addEventListener("click", () => { elements.zoomRange.value = Math.max(50, Number(elements.zoomRange.value) - 10); updateZoom(); });
elements.zoomIn.addEventListener("click", () => { elements.zoomRange.value = Math.min(200, Number(elements.zoomRange.value) + 10); updateZoom(); });
elements.compareRange.addEventListener("input", updateComparison);

elements.downloadBtn.addEventListener("click", () => {
  if (!svgData || !selectedFile) return;
  const url = URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml;charset=utf-8" }));
  const link = document.createElement("a");
  const baseName = selectedFile.name.replace(/\.[^.]+$/, "") || "vector-image";
  link.href = url;
  link.download = `${baseName}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("SVG downloaded successfully.", "success");
});

updateSettingOutputs();
updateZoom();
updateComparison();
