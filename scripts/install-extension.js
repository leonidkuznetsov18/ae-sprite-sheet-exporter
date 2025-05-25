import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { execSync } from 'child_process';

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set project paths
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

// Extension information
const extensionId = 'com.spritesheet.exporter';

/**
 * Get the Adobe CEP extensions path based on the operating system
 */
function getExtensionsPath() {
  const platform = os.platform();
  const homedir = os.homedir();
  
  let extensionsPath;
  
  if (platform === 'darwin') {
    // macOS path
    extensionsPath = path.join(
      homedir,
      'Library/Application Support/Adobe/CEP/extensions'
    );
  } else if (platform === 'win32') {
    // Windows path
    extensionsPath = path.join(
      os.homedir(),
      'AppData/Roaming/Adobe/CEP/extensions'
    );
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  return extensionsPath;
}

/**
 * Remove any existing extension (symlink or directory)
 */
async function removeExistingExtension(extensionPath) {
  try {
    // Check if path exists
    if (!(await fs.pathExists(extensionPath))) {
      return; // Nothing to remove
    }

    // Get stats to determine if it's a symlink
    const stats = await fs.lstat(extensionPath);
    
    if (stats.isSymbolicLink()) {
      // Remove symlink
      console.log(`Removing existing symlink at ${extensionPath}`);
      await fs.unlink(extensionPath);
    } else {
      // Remove directory or file
      console.log(`Removing existing directory/file at ${extensionPath}`);
      await fs.remove(extensionPath);
    }
  } catch (error) {
    console.error(`Error removing existing extension: ${error.message}`);
    // Continue execution even if there's an error
    console.log('Attempting to continue...');
  }
}

/**
 * Install the extension by creating a symbolic link
 */
async function installExtension() {
  try {
    // Check if dist directory exists
    if (!(await fs.pathExists(distDir))) {
      console.error('❌ Dist directory not found. Please run "npm run build" first.');
      process.exit(1);
    }
    
    const extensionsPath = getExtensionsPath();
    const extensionPath = path.join(extensionsPath, extensionId);
    
    console.log(`Extensions path: ${extensionsPath}`);
    console.log(`Extension ID: ${extensionId}`);
    console.log(`Target path: ${extensionPath}`);
    console.log(`Source path: ${distDir} (self-contained extension package)`);
    
    // Ensure extensions directory exists
    await fs.ensureDir(extensionsPath);
    
    // Remove existing extension
    await removeExistingExtension(extensionPath);
    
    // Create symlink to dist folder (self-contained extension)
    console.log(`Creating symlink from ${distDir} to ${extensionPath}`);
    
          if (os.platform() === 'win32') {
        // On Windows, use mklink command (requires admin privileges)
        try {
          execSync(`mklink /D "${extensionPath}" "${distDir}"`);
          console.log('✅ Extension installed successfully');
        } catch (error) {
          console.error('❌ Error creating symlink. Try running as administrator.');
          console.error(error.message);
          console.log('\nAlternatively, manually copy the files from:');
          console.log(distDir);
          console.log('to:');
          console.log(extensionPath);
        }
      } else {
        // On macOS/Linux, try to force remove any existing link again (just to be safe)
        try {
          execSync(`rm -rf "${extensionPath}"`);
        } catch (e) {
          // Ignore errors
        }
        
        // Create the symlink to dist folder
        await fs.symlink(distDir, extensionPath);
        console.log('✅ Extension installed successfully');
      }
    
    console.log('\nTo enable debugging:');
    if (os.platform() === 'darwin') {
      console.log('1. Create/edit ~/Library/Preferences/com.adobe.CSXS.10.plist');
      console.log('2. Add PlayerDebugMode key with value 1');
      console.log('3. Run: defaults read com.adobe.CSXS.10');
      
      // Optional: Set debug mode automatically
      console.log('\nSetting debug mode automatically...');
      try {
        execSync('defaults write com.adobe.CSXS.10 PlayerDebugMode 1');
        console.log('✅ Debug mode enabled successfully');
      } catch (error) {
        console.error('❌ Could not set debug mode automatically:', error.message);
      }
    } else {
      console.log('1. Open Registry Editor');
      console.log('2. Navigate to HKEY_CURRENT_USER/Software/Adobe/CSXS.10');
      console.log('3. Add PlayerDebugMode (String) with value 1');
    }
    
  } catch (error) {
    console.error('❌ Error installing extension:', error);
    
    // Provide fallback instructions
    console.log('\nIf symlink creation fails, you can manually copy the files:');
    console.log('1. Create a folder named "' + extensionId + '" in your extensions directory');
    console.log('2. Copy all files from this project to that folder');
  }
}

// Run the installation
installExtension();