const path = require('path');
const fs = require('fs-extra');

class SpriteSheetExporter {
  constructor() {
    this.csInterface = new CSInterface();
    this.currentCompInfo = null;
    
    this.elements = {
      compName: document.getElementById('comp-name'),
      frameCount: document.getElementById('frame-count'),
      dimensions: document.getElementById('comp-dimensions'),
      fps: document.getElementById('comp-fps'),
      updateBtn: document.getElementById('update-btn'),
      exportBtn: document.getElementById('export-btn'),
      status: document.getElementById('status-message'),
      debugOutput: document.getElementById('debug-output'),
      copyDebugBtn: document.getElementById('copy-debug-btn')
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
    this.elements.copyDebugBtn?.addEventListener('click', () => this.copyDebugLogs());
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
  
  async copyDebugLogs() {
    try {
      const debugText = this.elements.debugOutput?.textContent || '';
      if (!debugText.trim()) {
        this.showCopyFeedback('No logs to copy');
        return;
      }
      
      await navigator.clipboard.writeText(debugText);
      this.showCopyFeedback('Copied!');
    } catch (error) {
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = this.elements.debugOutput?.textContent || '';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showCopyFeedback('Copied!');
      } catch (fallbackError) {
        this.showCopyFeedback('Copy failed');
        console.error('Copy failed:', fallbackError);
      }
    }
  }
  
  showCopyFeedback(message) {
    const btn = this.elements.copyDebugBtn;
    if (!btn) return;
    
    const originalText = btn.textContent;
    btn.textContent = message;
    
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
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
    if (!this.currentCompInfo) {
      this.setStatus('No active composition found');
      return;
    }
    
    try {
      // Step 1: Select export folder (no loading state yet)
      this.setStatus('Please select export folder...');
      const folderResult = await this.callAEFunction('selectExportFolder()');
      const folderData = JSON.parse(folderResult);
      
      if (!folderData?.folderPath) {
        this.setStatus('Export cancelled - no folder selected');
        return;
      }
      
      // Step 2: Start loading state and begin export process
      this.setExportButtonLoading(true);
      this.setStatus('Starting export process...');
      
      // Allow UI to update before proceeding with heavy operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 3: Export frames from After Effects
      this.setStatus('Rendering frames from After Effects...');
      const renderResult = await this.evalScript('renderCompositionToPNGSequence', folderData.folderPath);
      
      if (renderResult.error) {
        throw new Error(`Frame export failed: ${renderResult.error}`);
      }
      
      if (!renderResult.tempFolder || renderResult.frameCount === 0) {
        throw new Error('No frames were exported');
      }
      
      // Step 4: Generate sprite sheet
      this.setStatus('Creating sprite sheet from individual frames...');
      const spriteResult = await this.generateSpriteSheet(
        renderResult.tempFolder,
        folderData.folderPath,
        renderResult.compInfo
      );
      
      if (!spriteResult.success) {
        throw new Error(`Sprite sheet generation failed: ${spriteResult.error}`);
      }
      
      // Step 5: Success!
      const folderName = path.basename(path.dirname(spriteResult.spriteSheetPath));
      this.setStatus(`✅ Export completed! Files saved to: ${folderName}`);
      this.logExportResults(spriteResult);
      
    } catch (error) {
      this.setStatus(`❌ Export failed: ${error.message}`);
      console.error('Export error:', error);
    } finally {
      // Always reset button state
      this.setExportButtonLoading(false);
    }
  }
  
  setExportButtonLoading(isLoading) {
    const btn = this.elements.exportBtn;
    if (!btn) return;
    
    if (isLoading) {
      btn.disabled = true;
      btn.textContent = '⏳ Loading...';
      btn.style.opacity = '0.7';
    } else {
      btn.disabled = false;
      btn.textContent = '📦 Export Sprite Sheet';
      btn.style.opacity = '1';
    }
    
    // Force UI update
    btn.offsetHeight;
  }
  
  async evalScript(functionName, ...args) {
    const script = args.length > 0 
      ? `${functionName}(${args.map(arg => `"${String(arg).replace(/"/g, '\\"')}"`).join(', ')})`
      : `${functionName}()`;
    
    const result = await this.callAEFunction(script);
    return JSON.parse(result);
  }
  
  async generateSpriteSheet(tempFolder, outputFolder, compInfo) {
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
      
      // Create dedicated output folder for this export
      const cleanCompName = compInfo.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const exportFolderName = `${cleanCompName}_spritesheet_${timestamp}`;
      const dedicatedOutputFolder = path.join(outputFolder, exportFolderName);
      
      if (!fs.existsSync(dedicatedOutputFolder)) {
        fs.mkdirSync(dedicatedOutputFolder, { recursive: true });
      }
      
      this.debug('Created dedicated output folder:', dedicatedOutputFolder);
      
      return await this.processCanvasGeneration(tempFolder, dedicatedOutputFolder, compInfo, pngFiles);
      
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
    const spriteSheetPath = path.join(outputFolder, `spritesheet.png`);
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
    const buffer = await blob.arrayBuffer();
    await fs.writeFile(spriteSheetPath, Buffer.from(buffer));
    
    // Generate metadata and usage examples
    const metadata_obj = this.createMetadata(compInfo, layout, frameWidth, frameHeight, framesToUse);
    const metadataPath = path.join(outputFolder, `metadata.json`);
    await fs.writeJson(metadataPath, metadata_obj, { spaces: 2 });
    
    // Cleanup
    this.cleanupTempFiles(tempFolder, framesToProcess);
    
    return {
      success: true,
      method: 'canvas',
      spriteSheetPath,
      metadataPath,
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
    // Simple square-ish layout for all frame counts
    const cols = Math.ceil(Math.sqrt(frameCount));
    const rows = Math.ceil(frameCount / cols);
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
    const folderPath = path.dirname(spriteResult.spriteSheetPath);
    const folderName = path.basename(folderPath);
    
    this.debug(`=== EXPORT COMPLETED ===`);
    this.debug(`Export folder: ${folderName}`);
    this.debug(`Full path: ${folderPath}`);
    this.debug(`Files created:`);
    this.debug(`  🖼️ spritesheet.png`);
    this.debug(`  📄 metadata.json`);
    this.debug(`Total frames: ${spriteResult.frameCount}`);
    this.debug(`Generation method: ${spriteResult.method}`);
    
    if (spriteResult.outputs?.length > 0) {
      this.debug('\nFile details:');
      for (const output of spriteResult.outputs) {
        this.debug(`  ${output.format}: ${output.sizeKB}KB - ${output.description}`);
      }
    }
  }
  
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SpriteSheetExporter();
}); 