# Node.js Version Requirements

This project is configured to use **Node.js 17.7.1** specifically.

## Why Node.js 17.7.1?

- **CEP Compatibility**: Adobe CEP (Common Extensibility Platform) works best with specific Node.js versions
- **Sharp Library Support**: Sharp (our image processing library) has tested compatibility with Node.js 17.x
- **Stability**: Node.js 17.7.1 provides the right balance of features and stability for this project

## Quick Setup

### Option 1: Using NVM (Recommended)

```bash
# Install the required Node.js version
nvm install 17.7.1

# Use the version (this will also read .nvmrc automatically)
nvm use

# Verify the version
node --version  # Should output: v17.7.1
```

### Option 2: Manual Installation

1. Download Node.js 17.7.1 from: https://nodejs.org/download/release/v17.7.1/
2. Install for your platform
3. Verify: `node --version`

## Verification

Run our setup script to verify your environment:

```bash
npm run setup
```

This will check:
- ✅ Node.js version matches 17.7.1
- ✅ Sharp library compatibility
- ✅ Platform-specific configuration
- ✅ Project dependencies

## Project Configuration

### Files Added/Modified:

1. **`.nvmrc`** - Contains `17.7.1` for automatic NVM switching
2. **`package.json`** - Added `engines.node: "17.7.1"` requirement
3. **`scripts/setup-node.js`** - Environment verification script

### NPM Scripts:

- `npm run setup` - Verify Node.js environment
- `npm run check-env` - Same as setup (alias)
- `npm run use-node` - Switch to project Node.js version (requires NVM)

## Troubleshooting

### Sharp Installation Issues

If Sharp fails to install or load:

```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules
npm install

# Force Sharp rebuild for your Node.js version
npm rebuild sharp
```

### Version Mismatch Warnings

If you see version mismatch warnings:

1. **With NVM**: Run `nvm use` in the project directory
2. **Without NVM**: Install Node.js 17.7.1 manually
3. **In CI/CD**: Use Node.js 17.7.1 in your pipeline configuration

### Adobe CEP Issues

If the extension doesn't load in After Effects:

1. Verify Node.js version: `node --version`
2. Check CEP debug mode is enabled
3. Restart After Effects after version change
4. Check the CEP logs for Node.js related errors

## Platform Notes

### macOS
- **Intel Macs**: Native binaries available
- **Apple Silicon (M1/M2)**: Ensure correct Sharp binary via `npm rebuild sharp`

### Windows
- Prebuilt binaries should work out of the box
- If issues persist, install Visual Studio Build Tools

### Linux
- May require additional system libraries
- Install build essentials: `sudo apt-get install build-essential`

## Alternative Versions

While this project is optimized for Node.js 17.7.1, it may work with:

- ✅ **Node.js 16.x**: Generally compatible but not tested
- ⚠️ **Node.js 18.x**: May work but could have CEP compatibility issues  
- ❌ **Node.js 14.x or older**: Not recommended, missing required features
- ❌ **Node.js 19.x or newer**: Not tested, potential compatibility issues

**Recommendation**: Stick with 17.7.1 for the best experience.

## Integration with Development Tools

### VSCode
Add to `.vscode/settings.json`:
```json
{
  "nodejs.version": "17.7.1"
}
```

### Docker
```dockerfile
FROM node:17.7.1-alpine
# ... rest of your Dockerfile
```

### CI/CD
```yaml
# GitHub Actions example
- uses: actions/setup-node@v3
  with:
    node-version: '17.7.1'
```

---

For any Node.js version related issues, run `npm run setup` first to diagnose the problem. 