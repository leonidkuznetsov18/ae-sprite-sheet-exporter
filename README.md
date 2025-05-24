# After Effects Sprite Sheet Exporter

A CEP extension for Adobe After Effects that exports the active composition as a sprite sheet (PNG or WebP) with an accompanying JSON metadata file.

## Features

- Export active composition as a sprite sheet
- Support for PNG and WebP formats
- Three layout options: horizontal, vertical, or grid
- Generate JSON metadata with frame positions and animation data
- Uses After Effects render queue for high-quality frame exports

## Installation

### Quick Installation (Development Mode)

This extension includes an automatic installation script that makes development and testing easier:

1. Clone this repository to your local machine
2. Install Node.js dependencies:
   ```
   npm install
   ```
3. Run the installation script:
   ```
   npm run install:extension
   ```

The script will:
- Create a symbolic link from the project to your Adobe CEP extensions folder
- Automatically enable debug mode for Adobe applications
- Provide feedback about the installation status

### Manual Installation (Development Mode)

If the automatic script doesn't work for you:

1. Clone this repository to your local machine
2. Enable debug mode in Adobe applications:
   - On Windows, create a registry entry:
     - HKEY_CURRENT_USER/Software/Adobe/CSXS.11 (or your version)
     - Add String value: "PlayerDebugMode" with value "1"
   - On macOS, run in Terminal:
     ```
     defaults write com.adobe.CSXS.11 PlayerDebugMode 1
     ```
3. Copy the extension folder to your Adobe CEP extensions folder:
   - Windows: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions`
   - macOS: `/Library/Application Support/Adobe/CEP/extensions`
4. Restart After Effects

### Production Installation (ZXP)

1. Download the .zxp file from the releases page
2. Use Adobe Exchange or a tool like ZXP Installer to install the extension
3. Restart After Effects

## Usage

1. Open a composition in After Effects
2. Go to Window > Extensions > SpriteSheet Exporter
3. The extension will show information about the active composition
4. Select your preferred output format (PNG/WebP) and layout (horizontal/vertical/grid)
5. Click "Export Sprite Sheet"
6. Choose a save location
7. The extension will:
   - Render each frame using After Effects' render queue
   - Combine frames into a single sprite sheet
   - Create a JSON file with metadata about the frames

## JSON Format

The generated JSON file follows a standard format for sprite sheets:

```json
{
  "meta": {
    "image": "spritesheet.png",
    "format": "png",
    "size": {"w": 1280, "h": 720},
    "scale": "1"
  },
  "frames": {
    "frame_0": {
      "frame": {"x": 0, "y": 0, "w": 640, "h": 360},
      "sourceSize": {"w": 640, "h": 360},
      "spriteSourceSize": {"x": 0, "y": 0, "w": 640, "h": 360}
    },
    "frame_1": {
      "frame": {"x": 640, "y": 0, "w": 640, "h": 360},
      "sourceSize": {"w": 640, "h": 360},
      "spriteSourceSize": {"x": 0, "y": 0, "w": 640, "h": 360}
    }
  },
  "animations": {
    "MyComposition": {
      "frames": ["frame_0", "frame_1"]
    }
  }
}
```

## Development

### Scripts

- `npm run install:extension` - Creates a symbolic link from your project to the Adobe CEP extensions folder and enables debug mode

## Requirements

- Adobe After Effects CC 2018 or later
- CEP 9.0 or later
- Node.js 14.0 or later (for development and installation script)

## License

MIT 