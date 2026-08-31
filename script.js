"use strict";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_TYPES = new Set(["image/jpeg", "image/png"]);

const elements = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  selectedFile: document.querySelector("#selectedFile"),
  fileThumbnail: document.querySelector("#fileThumbnail"),
  fileName: document.querySelector("#fileName"),
  fileSize: document.querySelector("#fileSize"),
  removeFileBtn: document.querySelector("#removeFileBtn"),
  convertBtn: document.querySelector("#convertBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  statusMessage: document.querySelector("#statusMessage"),
  originalImage: document.querySelector("#originalImage"),
  originalEmpty: document.querySelector("#originalEmpty"),
  vectorPreview: document.querySelector("#vectorPreview"),
  vectorEmpty: document.querySelector("#vectorEmpty"),
};

let selectedFile = null;
let imageDataUrl = "";
let svgData = "";

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
}

function resetUploader() {
  selectedFile = null;
  imageDataUrl = "";
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
    elements.originalImage.hidden = false;
    elements.originalEmpty.hidden = true;
    elements.fileThumbnail.src = imageDataUrl;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);
    elements.selectedFile.hidden = false;
    elements.convertBtn.disabled = false;
    setStatus("Image ready. Select “Convert to vector” to continue.", "success");
  });
  reader.addEventListener("error", () => setStatus("We couldn’t read that image. Please try another file.", "error"));
  reader.readAsDataURL(file);
}

function openFilePicker() {
  elements.fileInput.click();
}

elements.dropZone.addEventListener("click", openFilePicker);
elements.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openFilePicker();
  }
});
elements.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) loadFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
});
elements.dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) loadFile(file);
});

elements.removeFileBtn.addEventListener("click", resetUploader);

elements.convertBtn.addEventListener("click", () => {
  if (!imageDataUrl || !selectedFile) {
    setStatus("Choose a JPG or PNG image first.", "error");
    return;
  }
  if (typeof window.ImageTracer === "undefined") {
    setStatus("The converter could not load. Check your internet connection and refresh the page.", "error");
    return;
  }

  elements.convertBtn.disabled = true;
  elements.convertBtn.querySelector("span").textContent = "Converting…";
  setStatus("Tracing shapes and colors…");

  window.ImageTracer.imageToSVG(
    imageDataUrl,
    (svg) => {
      svgData = svg;
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(svg, "image/svg+xml");
      const svgElement = documentNode.documentElement;

      if (svgElement.nodeName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) {
        setStatus("The vector result was invalid. Please try another image.", "error");
        elements.convertBtn.disabled = false;
        elements.convertBtn.querySelector("span").textContent = "Convert to vector";
        return;
      }

      svgElement.setAttribute("role", "img");
      svgElement.setAttribute("aria-label", `Vector version of ${selectedFile.name}`);
      elements.vectorPreview.replaceChildren(document.importNode(svgElement, true));
      elements.downloadBtn.disabled = false;
      elements.convertBtn.disabled = false;
      elements.convertBtn.querySelector("span").textContent = "Convert again";
      setStatus("Your vector is ready to download!", "success");
    },
    "posterized2"
  );
});

elements.downloadBtn.addEventListener("click", () => {
  if (!svgData || !selectedFile) return;
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const baseName = selectedFile.name.replace(/\.[^.]+$/, "") || "vector-image";
  link.href = url;
  link.download = `${baseName}-vector.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("SVG downloaded successfully.", "success");
});
