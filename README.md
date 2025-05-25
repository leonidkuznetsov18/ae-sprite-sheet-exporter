# AE Sprite Sheet Exporter

Adobe After Effects CEP extension for exporting compositions as optimized sprite sheets with JSON metadata. Built with modern ES6+ JavaScript and Vite for optimal performance and compatibility.

## Features

- **Modern Build System**: Built with Vite, using ES6+ syntax transpiled to ES3/5 for CEP compatibility
- **High-Quality Output**: Uses Sharp library for superior image processing
- **Smart Layout**: Automatically calculates optimal sprite sheet layouts
- **Comprehensive Metadata**: Generates detailed JSON with frame data and animation info
- **Multiple Formats**: Supports PNG, TIFF, PSD input from After Effects
- **Usage Examples**: Auto-generates code examples for popular frameworks

## Quick Start

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd ae-sprite-sheet-exporter
   npm install
   ```

2. **Build and install the extension:**
   ```bash
   npm run install:extension
   ```

3. **Open After Effects** and find "Sprite Sheet Exporter" in the Window > Extensions menu

### Development

- **Development build:** `npm run dev` (starts Vite dev server)
- **Production build:** `npm run build` (builds with Vite)
- **Build extension:** `npm run build:extension` (builds and copies all files to dist)
- **Install extension:** `npm run install:extension` (builds and symlinks to CEP extensions folder)

## Build System

This project uses a modern build system with the following architecture:

### Source Structure
```
src/
├── client/           # Modern ES6+ client-side code
│   ├── index.html   # Main UI (with modern styling)
│   ├── index.js     # Main application class
│   └── CSInterface.js # Adobe CEP interface
└── host/            # ExtendScript for After Effects
    └── index.jsx    # After Effects integration
```

### Build Process

1. **Vite Build**: Transpiles ES6+ to ES3/5 with polyfills for CEP compatibility
2. **File Copy**: Copies ExtendScript, manifest, and dependencies to `dist/`
3. **Symlink**: Creates symlink from `dist/` to CEP extensions folder

### Output Structure
```
dist/
├── index.html       # Transpiled UI
├── assets/          # Bundled JavaScript (modern + legacy)
├── host/            # ExtendScript files
├── CSXS/            # CEP manifest
└── package.json     # For Node.js module resolution from project root
```

## Usage

1. **Open After Effects** and create or open a composition
2. **Launch the extension** from Window > Extensions > Sprite Sheet Exporter
3. **Click "Update Composition Info"** to load your active composition
4. **Click "Export Sprite Sheet"** to select output folder and generate files

### Output Files

The extension generates exactly 2 files:
- `[composition_name]_spritesheet.png` - The optimized sprite sheet image
- `[composition_name]_metadata.json` - Frame data and animation metadata

## Technical Details

### Dependencies

- **Sharp**: High-performance image processing (supports TIFF/PSD from AE)
- **fs-extra**: Enhanced file system operations
- **Vite**: Modern build tool with ES6+ → ES3/5 transpilation
- **@vitejs/plugin-legacy**: Ensures compatibility with older CEP environments

### Compatibility

- **After Effects**: 2022 and later (CEP 12.0+)
- **Node.js**: 17.7.1+ (embedded in After Effects)
- **Platforms**: macOS and Windows

### Sharp Library Integration

The extension includes sophisticated Sharp library loading with multiple fallback strategies:
1. Direct require from node_modules
2. Extension-relative path resolution
3. Working directory resolution
4. Canvas fallback for unsupported environments

## Development Notes

### ES6+ Features Used

- Classes and arrow functions
- Async/await and Promises
- Template literals and destructuring
- Modern array methods (map, filter, etc.)
- Optional chaining (`?.`)

### CEP Compatibility

Vite's legacy plugin ensures compatibility by:
- Transpiling to ES3/5 syntax
- Including necessary polyfills
- Generating both modern and legacy bundles
- Supporting older Chromium versions in CEP

### Debugging

Debug mode is automatically enabled during installation. Check the debug output panel in the extension for detailed logging.

## Troubleshooting

### Sharp Library Issues
If Sharp fails to load, the extension will fall back to Canvas-based processing (PNG/JPEG only). To fix:
1. Ensure Node.js version compatibility
2. Rebuild Sharp: `npm rebuild sharp`
3. Check debug output for specific error messages

### Build Issues
- Ensure all dependencies are installed: `npm install`
- Clear dist and rebuild: `rm -rf dist && npm run build:extension`
- Check Node.js version: `node --version` (should be 17.7.1+)

### Extension Not Appearing
1. Verify debug mode is enabled
2. Check CEP extensions folder for symlink
3. Restart After Effects
4. Check Console for CEP errors

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes using modern ES6+ syntax
4. Test with `npm run install:extension`
5. Submit a pull request

---

**Built with ❤️ using modern JavaScript and Vite** 