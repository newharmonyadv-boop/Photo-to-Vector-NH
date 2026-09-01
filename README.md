# Vectorly — Photo to SVG

Vectorly 2 is a beginner-friendly, browser-based photo vectorizer. Upload a JPG or PNG, preview the original, fine-tune how it is traced, compare the result, and download an SVG—all without sending your image to a server.

## Features

- JPG and PNG upload by file picker or drag and drop
- Original image preview and generated SVG preview
- One-click vector conversion powered by [ImageTracerJS](https://github.com/jankovicsandras/imagetracerjs)
- Downloadable `.svg` files with friendly filenames
- Five color-count choices and three detail levels
- Smoothing, noise removal, outline, and transparent-background controls
- A **Batik High Detail** preset for curved ornaments and textile color separation
- Automatic preview updates after the first conversion
- Synchronized preview zoom and an interactive before/after comparison
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
4. Start with **Batik High Detail** for detailed textiles, or choose your own color and detail settings.
5. Select **Convert to vector** and wait for the SVG preview.
6. Change any setting to update an existing result automatically. Use the zoom buttons and drag the before/after slider to inspect small details.
7. Select **Download SVG**. The result keeps the original basename, such as `pattern.jpg` → `pattern.svg`.

To start over, remove the selected file with the × button and choose another image.

## How conversion works

The browser reads the selected image as a data URL. ImageTracerJS groups its colors and traces those areas into SVG paths using options generated from the controls. The generated SVG is previewed in the page and packaged as an SVG file only when you download it.

### Choosing settings

- **Color count** controls the size of the traced palette. More colors preserve subtle textile color separation but create a larger SVG.
- **Detail level** controls curve-fitting tolerances and the smallest paths retained. High detail uses tighter line and curve thresholds.
- **Smoothing** applies a light source-image blur before tracing to reduce stair-stepped edges. Strong smoothing can soften tiny ornaments.
- **Noise removal** omits increasingly small paths. Leave it off when every decorative mark matters.
- **Outline thickness** adds a stroke around traced color shapes.
- **Remove background** removes ImageTracer’s background color path to produce a transparent canvas. It works best when the subject has a distinct, simple background.

The **Batik High Detail** preset selects 32 colors, tight `0.35` line and curve thresholds, one-pixel path preservation, gentle smoothing, five color-quantization cycles, and a fine outline. This prioritizes curved ornament edges, small decorative shapes, and separated dye colors over file size or conversion speed.

All conversion happens locally in the browser. The application has no upload server and does not store your image.

> SVG tracing creates a stylized result rather than a pixel-perfect copy. High-resolution Batik photographs can take longer to trace; use even lighting and a straight-on photo for the cleanest color regions and curves.

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

Apply **Batik High Detail** or increase the color count and detail level. If edges are jagged, add gentle smoothing. If the SVG has unwanted specks, increase noise removal one step.

### Conversion becomes slow

High detail and 24–32 colors retain many more paths. Choose Medium detail, lower the color count, or resize an extremely large source photo before uploading.

### Nothing downloads

Allow downloads for the page in your browser, then select **Download SVG** again.

## Project structure

```text
.
├── index.html   # Page structure and content
├── styles.css   # Responsive visual design
├── script.js    # Upload, conversion, preview, and download logic
└── README.md    # Setup and usage documentation
```

## Development notes

No compilation is necessary. After editing the HTML, CSS, or JavaScript, refresh the browser. Keep browser developer tools open to spot console errors while testing.
