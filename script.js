"use strict";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_TYPES = new Set(["image/jpeg", "image/png"]);

const ids = ["fileInput", "dropZone", "selectedFile", "fileThumbnail", "fileName", "fileSize", "removeFileBtn", "convertBtn", "downloadBtn", "statusMessage", "originalPreview", "originalImage", "originalEmpty", "vectorPreview", "vectorEmpty", "settings", "batikPreset", "colorCount", "detailLevel", "smoothing", "smoothingValue", "noiseRemoval", "noiseValue", "outlineThickness", "outlineValue", "removeBackground", "engineMode", "engineDescription", "productionSettings", "productionColors", "productionSmoothing", "productionSmoothingValue", "minimumArea", "minimumAreaValue", "holeFilling", "holeFillingValue", "shadowCorrection", "shadowCorrectionValue", "preserveDots", "comparison", "cleanedCard", "cleanedPreview", "cleanedEmpty", "cleanedCanvas", "palettePanel", "paletteSwatches", "zoomOut", "zoomRange", "zoomValue", "zoomIn", "compareCard", "compareOriginal", "compareAfter", "compareLine", "compareRange", "compareValue"];
const elements = Object.fromEntries(ids.map((id) => [id, document.querySelector(`#${id}`)]));

let selectedFile = null;
let imageDataUrl = "";
let svgData = "";
let hasConverted = false;
let conversionId = 0;
let reconvertTimer = 0;
let productionResult = null;

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
  elements.cleanedCanvas.hidden = true;
  elements.cleanedEmpty.hidden = false;
  elements.palettePanel.hidden = true;
  elements.paletteSwatches.replaceChildren();
  productionResult = null;
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
  elements.originalPreview.replaceChildren(elements.originalEmpty, elements.originalImage);
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
    elements.originalPreview.replaceChildren(elements.originalImage);
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
  if (elements.engineMode.value === "production") {
    convertProduction();
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

function productionOptions() {
  return {
    edgeSmoothing: Number(elements.productionSmoothing.value),
    minimumArea: Number(elements.minimumArea.value),
    holeFilling: Number(elements.holeFilling.value),
    shadowCorrection: Number(elements.shadowCorrection.value),
    preserveDots: elements.preserveDots.checked,
  };
}

function imageDataFromUpload() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      resolve(context.getImageData(0, 0, width, height));
    });
    image.addEventListener("error", () => reject(new Error("Image decoding failed")));
    image.src = imageDataUrl;
  });
}

function showCleanedPreview(segmented) {
  const raster = window.BatikEngine.renderRaster(segmented);
  elements.cleanedCanvas.width = raster.width;
  elements.cleanedCanvas.height = raster.height;
  elements.cleanedCanvas.getContext("2d").putImageData(new ImageData(raster.data, raster.width, raster.height), 0, 0);
  elements.cleanedCanvas.hidden = false;
  elements.cleanedEmpty.hidden = true;
}

function updateProductionSvg() {
  const options = productionOptions();
  svgData = window.BatikEngine.layeredSvg(productionResult, options);
  const parsed = new DOMParser().parseFromString(svgData, "image/svg+xml").documentElement;
  elements.vectorPreview.replaceChildren(document.importNode(parsed, true));
  elements.compareAfter.replaceChildren(document.importNode(parsed, true));
  elements.vectorEmpty.hidden = true;
  elements.compareCard.hidden = false;
  elements.downloadBtn.disabled = false;
}

function renderPalette() {
  const swatches = productionResult.palette.map((color, index) => {
    const label = document.createElement("label");
    label.className = "palette-swatch";
    const input = document.createElement("input");
    input.type = "color"; input.value = color.hex;
    input.setAttribute("aria-label", `Change production color ${index + 1}`);
    input.style.setProperty("--swatch", color.hex);
    input.addEventListener("input", () => {
      color.hex = input.value;
      color.rgb = [1, 3, 5].map((start) => parseInt(input.value.slice(start, start + 2), 16));
      input.style.setProperty("--swatch", input.value);
      showCleanedPreview(productionResult);
      updateProductionSvg();
      setStatus(`Color layer ${index + 1} updated.`, "success");
    });
    const text = document.createElement("span"); text.textContent = color.hex.toUpperCase();
    label.append(input, text); return label;
  });
  elements.paletteSwatches.replaceChildren(...swatches);
  elements.palettePanel.hidden = false;
}

async function convertProduction() {
  if (typeof window.BatikEngine === "undefined") {
    setStatus("The Batik Production Engine could not load.", "error");
    return;
  }
  const thisConversion = ++conversionId;
  elements.convertBtn.disabled = true;
  elements.convertBtn.querySelector("span").textContent = "Building layers…";
  setStatus("Correcting lighting and cleaning color shapes…");
  try {
    const source = await imageDataFromUpload();
    if (thisConversion !== conversionId) return;
    const options = productionOptions();
    const preprocessed = window.BatikEngine.preprocess(source, options);
    const segmented = window.BatikEngine.quantize(preprocessed, Number(elements.productionColors.value));
    productionResult = window.BatikEngine.cleanSegments(segmented, options);
    showCleanedPreview(productionResult);
    updateProductionSvg();
    renderPalette();
    hasConverted = true;
    setStatus(`Production vector ready with ${productionResult.palette.length} editable color layers.`, "success");
  } catch (error) {
    setStatus("The production conversion could not be completed. Try a smaller image.", "error");
  } finally {
    elements.convertBtn.disabled = false;
    elements.convertBtn.querySelector("span").textContent = hasConverted ? "Convert again" : "Convert to vector";
  }
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
  elements.productionSmoothingValue.textContent = elements.productionSmoothing.value;
  elements.minimumAreaValue.textContent = `${elements.minimumArea.value} px`;
  elements.holeFillingValue.textContent = elements.holeFilling.value;
  elements.shadowCorrectionValue.textContent = `${elements.shadowCorrection.value}%`;
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
elements.productionSettings.addEventListener("input", scheduleReconvert);
elements.productionSettings.addEventListener("change", scheduleReconvert);
elements.engineMode.addEventListener("change", () => {
  const production = elements.engineMode.value === "production";
  elements.productionSettings.hidden = !production;
  elements.settings.hidden = production;
  elements.cleanedCard.hidden = !production;
  elements.comparison.classList.toggle("three-stage", production);
  elements.engineDescription.textContent = production
    ? "Preprocesses lighting and noise, separates perceptual colors, cleans shapes, and exports editable color layers."
    : "Version 2 conversion powered by ImageTracerJS with the original fine-tuning controls.";
  hasConverted = false;
  clearVector();
  elements.convertBtn.disabled = !selectedFile;
  setStatus(selectedFile ? "Engine changed. Select Convert to vector." : "Choose an image to get started.");
});
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
