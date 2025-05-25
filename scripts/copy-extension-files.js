import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set project paths
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const srcDir = path.join(projectRoot, 'src');

console.log('📦 Copying extension files to dist...');

async function copyExtensionFiles() {
  try {
    // Ensure dist directory exists (Vite should have created it)
    if (!await fs.pathExists(distDir)) {
      throw new Error('Dist directory not found. Please run "npm run build" first.');
    }

    console.log('✅ Dist directory found');

    // Copy host files (ExtendScript)
    const hostSrcDir = path.join(srcDir, 'host');
    const hostDistDir = path.join(distDir, 'host');
    
    if (await fs.pathExists(hostSrcDir)) {
      await fs.copy(hostSrcDir, hostDistDir);
      console.log('✅ Copied host files (ExtendScript)');
    } else {
      console.warn('⚠️ Host source directory not found');
    }

    // Copy CSInterface.js to dist root
    const csInterfaceSrc = path.join(srcDir, 'client', 'CSInterface.js');
    const csInterfaceDist = path.join(distDir, 'CSInterface.js');
    
    if (await fs.pathExists(csInterfaceSrc)) {
      await fs.copy(csInterfaceSrc, csInterfaceDist);
      console.log('✅ Copied CSInterface.js');
    } else {
      console.warn('⚠️ CSInterface.js not found');
    }

    // Copy CSXS manifest
    const csxsSrcDir = path.join(projectRoot, 'CSXS');
    const csxsDistDir = path.join(distDir, 'CSXS');
    
    if (await fs.pathExists(csxsSrcDir)) {
      await fs.copy(csxsSrcDir, csxsDistDir);
      console.log('✅ Copied CSXS manifest');
    } else {
      console.warn('⚠️ CSXS directory not found');
    }

    // Copy .debug file if it exists
    const debugFile = path.join(projectRoot, '.debug');
    const debugDistFile = path.join(distDir, '.debug');
    
    if (await fs.pathExists(debugFile)) {
      await fs.copy(debugFile, debugDistFile);
      console.log('✅ Copied .debug file');
    }

    // Note: Node.js dependencies will be resolved from the project root at runtime
    // CEP extensions can access the project's node_modules via require() calls
    console.log('📝 Node.js dependencies will be resolved from project root at runtime');

    // Move HTML file to root if it's in a subdirectory
    const htmlFileInSubdir = path.join(distDir, 'src', 'client', 'index.html');
    const htmlFileRoot = path.join(distDir, 'index.html');
    
    if (await fs.pathExists(htmlFileInSubdir) && !await fs.pathExists(htmlFileRoot)) {
      await fs.move(htmlFileInSubdir, htmlFileRoot);
      console.log('✅ Moved HTML file to root');
      
      // Clean up empty directories
      try {
        await fs.remove(path.join(distDir, 'src'));
        console.log('✅ Cleaned up empty src directory');
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Update the HTML file to use the correct script path
    if (await fs.pathExists(htmlFileRoot)) {
      let htmlContent = await fs.readFile(htmlFileRoot, 'utf8');
      
      // Fix paths to relative paths for CEP compatibility
      htmlContent = htmlContent.replace(/src="\/assets\//g, 'src="./assets/');
      htmlContent = htmlContent.replace(/href="\/assets\//g, 'href="./assets/');
      htmlContent = htmlContent.replace(/src="\.\.\/\.\.\/assets\//g, 'src="./assets/');
      htmlContent = htmlContent.replace(/href="\.\.\/\.\.\/assets\//g, 'href="./assets/');
      htmlContent = htmlContent.replace(/data-src="\.\.\/\.\.\/assets\//g, 'data-src="./assets/');
      
      await fs.writeFile(htmlFileRoot, htmlContent);
      console.log('✅ Updated HTML script references');
    }



    console.log('\n🎉 Extension files copied successfully!');
    console.log(`📁 Distribution ready in: ${distDir}`);
    
    // Show directory structure
    console.log('\n📋 Distribution structure:');
    await showDirectoryStructure(distDir, '');

  } catch (error) {
    console.error('❌ Error copying extension files:', error);
    process.exit(1);
  }
}

async function showDirectoryStructure(dir, indent) {
  try {
    const items = await fs.readdir(dir);
    const maxItems = 10; // Limit output to avoid spam
    
    for (let i = 0; i < Math.min(items.length, maxItems); i++) {
      const item = items[i];
      const itemPath = path.join(dir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        console.log(`${indent}📁 ${item}/`);
        if (indent.length < 6 && !item.startsWith('.') && item !== 'node_modules') {
          await showDirectoryStructure(itemPath, indent + '  ');
        }
      } else {
        console.log(`${indent}📄 ${item}`);
      }
    }
    
    if (items.length > maxItems) {
      console.log(`${indent}... and ${items.length - maxItems} more items`);
    }
  } catch (error) {
    console.log(`${indent}❌ Error reading directory: ${error.message}`);
  }
}

// Run the copy process
copyExtensionFiles(); 