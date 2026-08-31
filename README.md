# Vectorly — Photo to SVG

Vectorly is a beginner-friendly, browser-based photo vectorizer. Upload a JPG or PNG, preview the original, convert it to an SVG-style vector, and download the result—all without sending your image to a server.

## Features

- JPG and PNG upload by file picker or drag and drop
- Original image preview and generated SVG preview
- One-click vector conversion powered by [ImageTracerJS](https://github.com/jankovicsandras/imagetracerjs)
- Downloadable `.svg` files with friendly filenames
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
4. Select **Convert to vector** and wait for the SVG preview.
5. Select **Download SVG**. The result is saved as `<original-name>-vector.svg`.

To start over, remove the selected file with the × button and choose another image.

## How conversion works

The browser reads the selected image as a data URL. ImageTracerJS groups its colors and traces those areas into SVG paths using its `posterized2` preset. The generated SVG is previewed in the page and packaged as an SVG file only when you download it.

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
├── script.js    # Upload, conversion, preview, and download logic
└── README.md    # Setup and usage documentation
```

## Development notes

No compilation is necessary. After editing the HTML, CSS, or JavaScript, refresh the browser. Keep browser developer tools open to spot console errors while testing.
