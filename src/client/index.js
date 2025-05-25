// Load Node.js modules at the top level
const path = require('path');
const os = require('os');
const fs = require('fs-extra');

// Canvas-based sprite sheet generation (PNG only)

// Modern ES6+ client-side code for CEP extension
class SpriteSheetExporter {
  constructor() {
    this.csInterface = new CSInterface();
    this.currentCompInfo = null;
    
    // DOM Elements
    this.elements = {
      compName: document.getElementById('comp-name'),
      frameCount: document.getElementById('frame-count'),
      dimensions: document.getElementById('comp-dimensions'),
      fps: document.getElementById('comp-fps'),
      updateBtn: document.getElementById('update-btn'),
      exportBtn: document.getElementById('export-btn'),
      status: document.getElementById('status-message'),
      debugOutput: document.getElementById('debug-output')
    };
    
    this.init();
  }
  
  async init() {
    this.debug('=== SPRITE SHEET EXPORTER INITIALIZED ===');
    this.setStatus('Extension loaded. Initializing Node.js modules...');
    
    try {
      this.setupEventListeners();
      this.setStatus('Extension loaded. Click "Update Composition Info" to begin.');
      await this.updateCompInfo();
    } catch (error) {
      this.debug('Initialization error:', error);
      this.setStatus('Error: Failed to initialize extension');
    }
  }
  

  

  
  setupEventListeners() {
    this.elements.updateBtn?.addEventListener('click', () => this.updateCompInfo());
    this.elements.exportBtn?.addEventListener('click', () => this.exportSpriteSheet());
  }
  
  debug(message, obj) {
    const timestamp = new Date().toLocaleTimeString();
    let logMessage = `[${timestamp}] ${message}`;
    
    if (obj !== undefined) {
      try {
        if (typeof obj === 'object') {
          logMessage += `\n${JSON.stringify(obj, null, 2)}`;
        } else {
          logMessage += ` ${obj}`;
        }
      } catch (error) {
        logMessage += ' [Object could not be stringified]';
      }
    }
    
    console.log(logMessage);
    
    if (this.elements.debugOutput) {
      // Preserve existing content and append new message
      const currentContent = this.elements.debugOutput.textContent || '';
      this.elements.debugOutput.textContent = currentContent + logMessage + '\n';
      this.elements.debugOutput.scrollTop = this.elements.debugOutput.scrollHeight;
    }
    
    return message;
  }
  
  setStatus(message) {
    if (this.elements.status) {
      this.elements.status.textContent = message;
    }
    this.debug(`Status: ${message}`);
  }
  
  async callAEFunction(script) {
    return new Promise((resolve, reject) => {
      this.csInterface.evalScript(script, (result) => {
        if (result === undefined || result === null) {
          reject(new Error('No response from After Effects'));
          return;
        }
        
        if (result.trim() === '') {
          reject(new Error('Empty response from After Effects'));
          return;
        }
        
        resolve(result);
      });
    });
  }
  
  async updateCompInfo() {
    this.setStatus('Fetching composition info...');
    
    try {
      // Test basic script execution
      const testResult = await this.callAEFunction('1+1');
      this.debug('Basic script test result:', testResult);
      
      // Get composition info
      const result = await this.callAEFunction('getActiveCompInfo()');
      this.debug('getActiveCompInfo raw result:', result);
      
      if (!result || result.trim() === '') {
        throw new Error('Empty response from ExtendScript');
      }
      
      const response = JSON.parse(result);
      this.debug('Parsed response:', response);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      this.currentCompInfo = response.data;
      
      if (!this.currentCompInfo) {
        throw new Error('No composition data received');
      }
      
      // Update UI
      this.updateUI();
      this.elements.exportBtn.disabled = false;
      this.setStatus('Ready to export');
      
    } catch (error) {
      console.error('Error updating composition info:', error);
      this.setStatus(`Error: ${error.message}`);
      this.elements.exportBtn.disabled = true;
    }
  }
  
  updateUI() {
    if (!this.currentCompInfo) return;
    
    this.elements.compName.textContent = this.currentCompInfo.name;
    this.elements.frameCount.textContent = this.currentCompInfo.frameCount;
    this.elements.dimensions.textContent = `${this.currentCompInfo.width} x ${this.currentCompInfo.height}`;
    this.elements.fps.textContent = `${this.currentCompInfo.frameRate} fps`;
  }
  
  async exportSpriteSheet() {
    try {
      if (!this.currentCompInfo) {
        this.setStatus('No active composition found');
        return;
      }
      
      this.setStatus('Please select export folder...');
      
      // Step 1: Select export folder
      const folderResult = await this.callAEFunction('selectExportFolder()');
      const folderData = JSON.parse(folderResult);
      
      if (!folderData?.folderPath) {
        this.setStatus('No folder selected, export cancelled');
        return;
      }
      
      const selectedFolder = folderData.folderPath;
      this.setStatus(`Selected folder: ${selectedFolder}`);
      this.setStatus('Starting export process...');
      
      // Step 2: Export individual frames
      this.setStatus('Rendering individual frames from After Effects...');
      const renderResult = await this.evalScript('renderCompositionToPNGSequence', selectedFolder);
      renderResult.selectedFolder = selectedFolder;
      
      if (renderResult.error) {
        throw new Error(`Frame export failed: ${renderResult.error}`);
      }
      
      if (!renderResult.tempFolder || renderResult.frameCount === 0) {
        throw new Error('No frames were exported');
      }
      
      // Show template analysis from After Effects
      if (renderResult.debug && renderResult.debug.length > 0) {
        this.debug('=== AFTER EFFECTS TEMPLATE ANALYSIS ===');
        for (const debugMsg of renderResult.debug) {
          if (debugMsg.includes('Available templates:') || 
              debugMsg.includes('PNG') || 
              debugMsg.includes('Template') ||
              debugMsg.includes('Format:') ||
              debugMsg.includes('Applied template:')) {
            this.debug(debugMsg);
          }
        }
      }
      
      this.setStatus(`Successfully exported ${renderResult.frameCount} frames`);
      
      // Step 3: Generate sprite sheet
      const spriteResult = await this.generateSpriteSheet(
        renderResult.tempFolder,
        renderResult.selectedFolder,
        renderResult.compInfo
      );
      
      if (!spriteResult.success) {
        throw new Error(`Sprite sheet generation failed: ${spriteResult.error}`);
      }
      
      // Step 4: Success!
      this.setStatus('Export completed successfully!');
      this.logExportResults(spriteResult);
      
      // Step 5: Validate files
      const validation = await this.validateExportedFiles(spriteResult);
      this.logValidationResults(validation);
      
    } catch (error) {
      this.setStatus(`Export failed: ${error.message}`);
      console.error('Export error:', error);
    }
  }
  
  detectImageFormat(files) {
    if (files.length === 0) return 'unknown';
    
    const firstFile = files[0];
    const ext = path.extname(firstFile).toLowerCase();
    
    const formatMap = {
      '.png': 'PNG',
      '.tif': 'TIFF',
      '.tiff': 'TIFF',
      '.psd': 'PSD',
      '.jpg': 'JPEG',
      '.jpeg': 'JPEG'
    };
    
    return formatMap[ext] || ext.substring(1).toUpperCase() || 'unknown';
  }
  
  async evalScript(functionName, ...args) {
    const script = args.length > 0 
      ? `${functionName}(${args.map(arg => `"${String(arg).replace(/"/g, '\\"')}"`).join(', ')})`
      : `${functionName}()`;
    
    const result = await this.callAEFunction(script);
    return JSON.parse(result);
  }
  
  async generateSpriteSheet(tempFolder, outputFolder, compInfo) {
    this.setStatus('Creating sprite sheet from individual frames...');
    
    try {
      this.debug('=== SPRITE SHEET GENERATION ===');
      this.debug('Temp folder:', tempFolder);
      this.debug('Output folder:', outputFolder);
      
      if (!fs.existsSync(tempFolder)) {
        throw new Error(`Temp folder does not exist: ${tempFolder}`);
      }
      
      const allFiles = fs.readdirSync(tempFolder);
      const pngFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.png');
      
      if (pngFiles.length === 0) {
        throw new Error(`No PNG files found. Found: ${allFiles.join(', ')}`);
      }
      
      // Sort files for proper frame order
      pngFiles.sort((a, b) => {
        const aMatch = a.match(/\d+/g);
        const aNum = parseInt(aMatch?.[aMatch.length - 1] || '0', 10);
        const bMatch = b.match(/\d+/g);
        const bNum = parseInt(bMatch?.[bMatch.length - 1] || '0', 10);
        return aNum - bNum;
      });
      
      this.debug('Sorted PNG files:', pngFiles);
      
      return await this.processCanvasGeneration(tempFolder, outputFolder, compInfo, pngFiles);
      
    } catch (error) {
      this.debug('Sprite sheet generation error:', error);
      throw error;
    }
  }
  

  

  
  async processCanvasGeneration(tempFolder, outputFolder, compInfo, framesToProcess) {
    this.debug('🎨 Starting Canvas-based sprite sheet generation');
    
    // All files should be PNG at this point
    const framesToUse = framesToProcess;
    
    // Load first image to get dimensions
    const firstImagePath = path.join(tempFolder, framesToUse[0]);
    const { width: frameWidth, height: frameHeight } = await this.getImageDimensions(firstImagePath);
    
    const frameCount = framesToUse.length;
    const layout = this.calculateSpriteLayout(frameCount);
    const spriteWidth = layout.cols * frameWidth;
    const spriteHeight = layout.rows * frameHeight;
    
    this.debug(`Canvas sprite layout: ${layout.cols}x${layout.rows} (${spriteWidth}x${spriteHeight})`);
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = spriteWidth;
    canvas.height = spriteHeight;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, spriteWidth, spriteHeight);
    
    // Load and draw all frames
    const loadPromises = framesToUse.map((filename, i) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const col = i % layout.cols;
          const row = Math.floor(i / layout.cols);
          const x = col * frameWidth;
          const y = row * frameHeight;
          
          ctx.drawImage(img, x, y, frameWidth, frameHeight);
          resolve();
        };
        img.onerror = (error) => {
          this.debug(`Failed to load image ${filename}: ${error}`);
          reject(new Error(`Failed to load image: ${filename}`));
        };
        img.src = 'file://' + path.join(tempFolder, filename);
      });
    });
    
    await Promise.all(loadPromises);
    
    // Convert canvas to blob and save
    const cleanCompName = compInfo.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const spriteSheetPath = path.join(outputFolder, `${cleanCompName}_spritesheet.png`);
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
    const buffer = await blob.arrayBuffer();
    await fs.writeFile(spriteSheetPath, Buffer.from(buffer));
    
    // Generate metadata and usage examples
    const metadata_obj = this.createMetadata(compInfo, layout, frameWidth, frameHeight, framesToUse);
    const metadataPath = path.join(outputFolder, `${cleanCompName}_metadata.json`);
    await fs.writeJson(metadataPath, metadata_obj, { spaces: 2 });
    
    const usageExamplesPath = path.join(outputFolder, `${cleanCompName}_usage_examples.md`);
    const usageExamples = this.generateUsageExamples(metadata_obj, cleanCompName);
    await fs.writeFile(usageExamplesPath, usageExamples);
    
    // Cleanup
    this.cleanupTempFiles(tempFolder, framesToProcess);
    
    return {
      success: true,
      method: 'canvas',
      spriteSheetPath,
      metadataPath,
      usageExamplesPath,
      frameCount: framesToUse.length,
      outputs: [{
        format: 'PNG',
        path: spriteSheetPath,
        description: 'Canvas-generated PNG sprite sheet',
        sizeKB: Math.round((await fs.stat(spriteSheetPath)).size / 1024)
      }]
    };
  }
  

  
  async getImageDimensions(imagePath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = 'file://' + imagePath;
    });
  }
  
  calculateSpriteLayout(frameCount) {
    let cols, rows;
    
    if (frameCount <= 8) {
      cols = frameCount;
      rows = 1;
    } else if (frameCount <= 16) {
      cols = Math.ceil(Math.sqrt(frameCount));
      rows = Math.ceil(frameCount / cols);
    } else {
      const sqrt = Math.sqrt(frameCount);
      cols = Math.ceil(sqrt);
      rows = Math.ceil(frameCount / cols);
      
      const ratio = cols / rows;
      if (ratio > 2) {
        cols = Math.max(1, Math.floor(sqrt));
        rows = Math.ceil(frameCount / cols);
      } else if (ratio < 0.5) {
        cols = Math.ceil(sqrt * 1.5);
        rows = Math.ceil(frameCount / cols);
      }
    }
    
    return { cols, rows };
  }
  
  createMetadata(compInfo, layout, frameWidth, frameHeight, framesToProcess) {
    const frameData = framesToProcess.map((filename, i) => {
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);
      const x = col * frameWidth;
      const y = row * frameHeight;
      
      return {
        frame: i,
        filename,
        x, y,
        width: frameWidth,
        height: frameHeight,
        normalizedX: x / (layout.cols * frameWidth),
        normalizedY: y / (layout.rows * frameHeight),
        normalizedWidth: frameWidth / (layout.cols * frameWidth),
        normalizedHeight: frameHeight / (layout.rows * frameHeight)
      };
    });
    
    return {
      composition: {
        name: compInfo.name,
        width: compInfo.width,
        height: compInfo.height,
        frameRate: compInfo.frameRate,
        duration: compInfo.duration,
        frameCount: compInfo.frameCount
      },
      spriteSheet: {
        width: layout.cols * frameWidth,
        height: layout.rows * frameHeight,
        cols: layout.cols,
        rows: layout.rows,
        frameWidth,
        frameHeight,
        aspectRatio: (layout.cols * frameWidth) / (layout.rows * frameHeight),
        efficiency: framesToProcess.length / (layout.cols * layout.rows)
      },
      frames: frameData,
      animation: {
        frameTime: 1.0 / compInfo.frameRate,
        totalDuration: compInfo.duration,
        loop: true,
        sequence: frameData.map(frame => frame.frame)
      },
      exportInfo: {
        timestamp: new Date().toISOString(),
        totalFrames: framesToProcess.length,
        successfulFrames: framesToProcess.length,
        exporter: "AE Sprite Sheet Exporter v2.0 (Canvas)",
        method: "canvas",
        outputFormat: "PNG"
      }
    };
  }
  
  generateUsageExamples(metadata, cleanCompName) {
    // Simplified version - would include all the usage examples from the original
    return `# Sprite Sheet Usage Examples\n\nGenerated from: ${metadata.composition.name}\n\n## File Information\n- **Sprite Sheet**: ${cleanCompName}_spritesheet.png\n- **Frames**: ${metadata.frames.length} frames\n- **Layout**: ${metadata.spriteSheet.cols} columns × ${metadata.spriteSheet.rows} rows\n\n## JavaScript (ES6+)\n\n\`\`\`javascript\nclass SpriteAnimation {\n  constructor(imagePath, metadata) {\n    this.image = new Image();\n    this.image.src = imagePath;\n    this.metadata = metadata;\n    this.currentFrame = 0;\n    this.frameTime = metadata.animation.frameTime * 1000;\n    this.lastFrameTime = 0;\n  }\n  \n  update(currentTime) {\n    if (currentTime - this.lastFrameTime >= this.frameTime) {\n      this.currentFrame = (this.currentFrame + 1) % this.metadata.frames.length;\n      this.lastFrameTime = currentTime;\n    }\n  }\n  \n  draw(ctx, x, y) {\n    const frame = this.metadata.frames[this.currentFrame];\n    ctx.drawImage(\n      this.image,\n      frame.x, frame.y, frame.width, frame.height,\n      x, y, frame.width, frame.height\n    );\n  }\n}\n\`\`\`\n`;
  }
  
  cleanupTempFiles(tempFolder, framesToProcess) {
    try {
      for (const filename of framesToProcess) {
        fs.unlinkSync(path.join(tempFolder, filename));
      }
      fs.rmdirSync(tempFolder);
      this.debug('Cleaned up temporary files');
    } catch (error) {
      this.debug(`Warning: Could not clean up temp folder: ${error.message}`);
    }
  }
  
  logExportResults(spriteResult) {
    this.debug(`Sprite sheet: ${spriteResult.spriteSheetPath}`);
    this.debug(`Metadata: ${spriteResult.metadataPath}`);
    this.debug(`Usage examples: ${spriteResult.usageExamplesPath}`);
    this.debug(`Total frames: ${spriteResult.frameCount}`);
    this.debug(`Generation method: ${spriteResult.method}`);
    
    if (spriteResult.outputs?.length > 0) {
      this.debug('\nGenerated files:');
      for (const output of spriteResult.outputs) {
        this.debug(`  ${output.format}: ${output.sizeKB}KB - ${output.description}`);
      }
    }
  }
  
  async validateExportedFiles(spriteResult) {
    const errors = [];
    const warnings = [];
    
    try {
      // Check sprite sheet file
      if (!fs.existsSync(spriteResult.spriteSheetPath)) {
        errors.push(`Sprite sheet file not found: ${spriteResult.spriteSheetPath}`);
      } else {
        const stats = fs.statSync(spriteResult.spriteSheetPath);
        if (stats.size === 0) {
          errors.push('Sprite sheet file is empty');
        } else {
          this.debug(`✅ Sprite sheet file validated: ${Math.round(stats.size / 1024)}KB`);
        }
      }
      
      // Check metadata file
      if (!fs.existsSync(spriteResult.metadataPath)) {
        errors.push(`Metadata file not found: ${spriteResult.metadataPath}`);
      } else {
        try {
          const metadata = fs.readJsonSync(spriteResult.metadataPath);
          if (!metadata.frames || !Array.isArray(metadata.frames)) {
            errors.push('Metadata file missing frames array');
          } else if (metadata.frames.length !== spriteResult.frameCount) {
            warnings.push(`Frame count mismatch: expected ${spriteResult.frameCount}, got ${metadata.frames.length}`);
          } else {
            this.debug(`✅ Metadata file validated: ${metadata.frames.length} frames`);
          }
        } catch (jsonError) {
          errors.push(`Metadata file is not valid JSON: ${jsonError.message}`);
        }
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }
  
  logValidationResults(validation) {
    if (validation.valid) {
      this.debug('✅ All files validated successfully!');
    } else {
      this.debug('❌ Validation errors found:');
      for (const error of validation.errors) {
        this.debug(`  - ${error}`);
      }
    }
    
    if (validation.warnings.length > 0) {
      this.debug('⚠️ Warnings:');
      for (const warning of validation.warnings) {
        this.debug(`  - ${warning}`);
      }
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SpriteSheetExporter();
}); 