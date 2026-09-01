# Vectorly — Experimental Version 3

Vectorly is a beginner-friendly, browser-based photo vectorizer. Version 3 adds an experimental **Batik Production Engine** while preserving the complete Version 2 converter as the **Legacy Engine**. Everything still runs locally in the browser.

## Features

### Batik Production Engine (experimental)

- Lighting normalization, brightness/contrast correction, and edge-aware noise reduction
- Perceptual LAB color quantization with 8, 12, 16, or 24 production colors
- Connected-region cleanup, configurable minimum shape size, morphological hole filling, and optional decorative-dot preservation
- Three-stage Original Photo, Cleaned Color Preview, and Final Layered SVG workspace
- Editable extracted palette that updates the cleaned preview and SVG layers
- Closed, simplified, smoothed contours grouped into descriptive, Illustrator-friendly SVG color layers

### Legacy Engine (Version 2)

- JPG and PNG upload by file picker or drag and drop
- Responsive, side-by-side original and SVG previews
- Color count, detail, smoothing, noise removal, outline, and background controls
- **Batik High Detail** preset for curved ornaments, fine decoration, and distinct colors
- Automatic reconversion whenever settings change after the first trace
- Synchronized 50–200% preview zoom
- Interactive before-and-after comparison slider
- One-click vector conversion powered by [ImageTracerJS](https://github.com/jankovicsandras/imagetracerjs)
- Downloadable `.svg` files that retain the original base filename
- Clear validation, loading, success, and error messages
- Responsive, keyboard-accessible interface
- Local browser processing for image privacy

## Run the website

This is a static website, so there is no package installation or build step.

### Option 1: Open it directly

Open `index.html` in a modern web browser. An internet connection is required to load ImageTracerJS and the web fonts from their CDNs.

### Option 2: Start a local server (recommended)

From the project folder, run:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000) in your browser.

## How to use it

1. Drag a photo onto the upload area, or select **browse your files**.
2. Choose a JPG or PNG file no larger than 10 MB.
3. Confirm that the original photo appears in the preview.
4. Keep **Batik Production Engine** selected for production cleanup, or choose **Legacy Engine (Version 2)** for the previous ImageTracerJS workflow.
5. Adjust production colors, edge smoothing, minimum shape size, hole filling, shadow correction, and decorative-dot preservation.
6. Select **Convert to vector** and inspect the cleaned-color and layered-SVG stages. Later setting changes reconvert automatically.
7. Optionally select an extracted palette swatch and choose a replacement color.
8. Zoom the previews together or drag the before-and-after handle to inspect the result.
9. Select **Download SVG**. The result is saved as `<original-name>.svg`.

To start over, remove the selected file with the × button and choose another image.

## How conversion works

The production pipeline downsizes very large inputs for responsive browser processing, normalizes local luminance, applies an edge-aware blur, clusters pixels using LAB color distance, cleans connected regions, fills tiny holes, and follows each color boundary into closed paths. Each color becomes a named SVG group with even-odd paths so holes remain editable. The Legacy Engine continues to use ImageTracerJS and all Version 2 controls.

All conversion happens locally in the browser. The application has no upload server and does not store your image.

> SVG tracing creates a stylized result rather than a pixel-perfect copy. Photos with clear subjects, strong contrast, and fewer colors generally produce the cleanest vectors.

## Supported browsers and files

- Current versions of Chrome, Edge, Firefox, and Safari
- JPEG files (`.jpg` and `.jpeg`)
- PNG files (`.png`)
- Maximum file size: 10 MB

## Troubleshooting

### “The converter could not load”

Check your internet connection and refresh the page. ImageTracerJS is loaded from jsDelivr when the page opens.

### My image is rejected

Confirm that it is a JPG or PNG under 10 MB. Renaming another file type to `.jpg` or `.png` does not change its actual format.

### The result is too detailed or looks posterized

That is a normal part of automatic tracing. Try a smaller image, a photo with stronger contrast, or an image with a simple background.

### Nothing downloads

Allow downloads for the page in your browser, then select **Download SVG** again.

## Project structure

```text
.
├── index.html   # Page structure and content
├── styles.css   # Responsive visual design
├── script.js    # Upload, engine selection, preview, and download logic
├── batik-engine.js # Dependency-free production image and contour pipeline
├── tests/       # Legacy application and production-engine tests
└── README.md    # Setup and usage documentation
```

## Development notes

No compilation is necessary. After editing the HTML, CSS, or JavaScript, refresh the browser. Keep browser developer tools open to spot console errors while testing.

Run the automated suite with:

```bash
node --test
```

Because every asset uses relative paths and there is no build step or server-side dependency, the root directory can be published directly with GitHub Pages.
