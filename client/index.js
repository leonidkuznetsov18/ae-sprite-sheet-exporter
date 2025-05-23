// Initialize CSInterface
const csInterface = new CSInterface();

// DOM Elements
const compNameEl = document.getElementById('comp-name');
const frameCountEl = document.getElementById('frame-count');
const dimensionsEl = document.getElementById('comp-dimensions');
const fpsEl = document.getElementById('comp-fps');
const updateBtn = document.getElementById('update-btn');
const exportBtn = document.getElementById('export-btn');
const statusEl = document.getElementById('status-message');
const debugOutputEl = document.getElementById('debug-output');

// State
let currentCompInfo = null;

// Get Node.js modules (enabled by --enable-nodejs flag in manifest)
let fs, path, os;
try {
    fs = require('fs-extra');
    path = require('path');
    os = require('os');
    debug("Node.js basic modules loaded successfully");
} catch (err) {
    console.error("Failed to load Node.js modules:", err);
    setStatus("Error: Node.js integration failed. Check extension settings.");
    debug("Error loading Node.js modules: " + err.message);
}

// Debug log function to add to debug panel
function debug(message, obj) {
    const timestamp = new Date().toLocaleTimeString();
    let logMessage = `[${timestamp}] ${message}`;
    
    if (obj !== undefined) {
        try {
            if (typeof obj === 'object') {
                logMessage += "\n" + JSON.stringify(obj, null, 2);
            } else {
                logMessage += " " + obj;
            }
        } catch (e) {
            logMessage += " [Object could not be stringified]";
        }
    }
    
    console.log(logMessage);
    
    if (debugOutputEl) {
        debugOutputEl.innerHTML += logMessage + "\n";
        debugOutputEl.scrollTop = debugOutputEl.scrollHeight;
    }
    
    return message;
}

// Update status message
function setStatus(message) {
    if (statusEl) {
        statusEl.textContent = message;
    }
    debug("Status: " + message);
}

// Update the UI with composition information
function updateCompInfo() {
    setStatus('Fetching composition info...');
    
    // Test basic script execution
    csInterface.evalScript('1+1', testResult => {
        debug("Basic script test result:", testResult);
        
        // Try to get composition info
        csInterface.evalScript('getActiveCompInfo()', result => {
            debug("getActiveCompInfo raw result:", result);
            
            // Check if result is empty or invalid
            if (!result || result.trim() === '') {
                setStatus('Error: Empty response from ExtendScript');
                exportBtn.disabled = true;
                return;
            }
            
            try {
                const response = JSON.parse(result);
                debug("Parsed response:", response);
                
                if (response.error) {
                    setStatus("Error: " + response.error);
                    exportBtn.disabled = true;
                    return;
                }
                
                // Store comp info in state
                currentCompInfo = response.data;
                
                if (!currentCompInfo) {
                    setStatus("Error: No composition data received");
                    exportBtn.disabled = true;
                    return;
                }
                
                // Update UI
                compNameEl.textContent = currentCompInfo.name;
                frameCountEl.textContent = currentCompInfo.frameCount;
                dimensionsEl.textContent = `${currentCompInfo.width} x ${currentCompInfo.height}`;
                fpsEl.textContent = `${currentCompInfo.frameRate} fps`;
                
                // Enable export button
                exportBtn.disabled = false;
                setStatus('Ready to export');
            } catch (err) {
                console.error('Error parsing composition info:', err);
                setStatus('Error: Could not retrieve composition info');
                debug("Parse error:", err.message);
                exportBtn.disabled = true;
            }
        });
    });
}

// Export the sprite sheet
function exportSpriteSheet() {
    if (!currentCompInfo) {
        setStatus('No composition selected');
        return;
    }
    
    setStatus('Preparing to export...');
    
    // Get a default name from the composition
    const defaultName = currentCompInfo.name.replace(/\s+/g, '_');
    
    // Step 1: Show folder picker and create a subfolder for the export
    csInterface.evalScript(`selectAndCreateExportFolder("${defaultName}")`, folderResult => {
        debug("Export folder result:", folderResult);
        
        if (!folderResult || folderResult === "null") {
            setStatus('Export cancelled');
            return;
        }
        
        try {
            // Parse the result (it's a JSON string from ExtendScript)
            const folderInfo = JSON.parse(folderResult);
            const outputFolder = folderInfo.folderPath;
            const folderName = folderInfo.fileName;
            
            debug("Output location:", { folder: outputFolder, folderName });
            
            if (!outputFolder) {
                setStatus('Export cancelled - invalid folder information');
                return;
            }
            
            // Add progress element if it doesn't exist
            let progressElement = document.getElementById('export-progress');
            if (!progressElement) {
                progressElement = document.createElement('div');
                progressElement.id = 'export-progress';
                progressElement.style.width = '100%';
                progressElement.style.height = '20px';
                progressElement.style.backgroundColor = '#eee';
                progressElement.style.marginTop = '10px';
                progressElement.style.position = 'relative';
                
                const progressBar = document.createElement('div');
                progressBar.style.width = '0%';
                progressBar.style.height = '100%';
                progressBar.style.backgroundColor = '#4CAF50';
                progressBar.style.transition = 'width 0.3s';
                progressBar.id = 'progress-bar';
                
                const progressText = document.createElement('div');
                progressText.style.position = 'absolute';
                progressText.style.top = '0';
                progressText.style.left = '0';
                progressText.style.width = '100%';
                progressText.style.height = '100%';
                progressText.style.display = 'flex';
                progressText.style.alignItems = 'center';
                progressText.style.justifyContent = 'center';
                progressText.style.color = '#000';
                progressText.style.fontWeight = 'bold';
                progressText.id = 'progress-text';
                progressText.textContent = 'Starting...';
                
                progressElement.appendChild(progressBar);
                progressElement.appendChild(progressText);
                
                // Insert before the status message element
                statusEl.parentNode.insertBefore(progressElement, statusEl.nextSibling);
            }
            
            // Reset and show progress
            const progressBar = document.getElementById('progress-bar');
            const progressText = document.getElementById('progress-text');
            progressBar.style.width = '0%';
            progressText.textContent = 'Starting export...';
            progressElement.style.display = 'block';
            
            // Step 2: Render frames directly to the chosen output folder
            setStatus('Rendering frames...');
            updateProgress(5, 'Initializing rendering...');
            
            const renderOptions = {
                outputDir: outputFolder
            };
            
            debug("Rendering with options:", renderOptions);
            csInterface.evalScript(`renderCompToImageSequence(${JSON.stringify(renderOptions)})`, renderResult => {
                debug("Render result raw:", renderResult);
                
                try {
                    const result = JSON.parse(renderResult);
                    debug("Parsed render result:", result);
                    
                    if (result.error) {
                        setStatus('Error: ' + result.error);
                        updateProgress(100, 'Error!');
                        return;
                    }
                    
                    if (!result.frameFiles || result.frameFiles.length === 0) {
                        setStatus('Error: No frames were rendered');
                        updateProgress(100, 'Error!');
                        return;
                    }
                    
                    const frameCount = result.frameFiles.length;
                    debug("Frame files count:", frameCount);
                    
                    // Step 3: Create sprite sheet with Canvas API using the folder name as filename
                    setStatus(`Processing ${frameCount} frames...`);
                    updateProgress(50, `Processing ${frameCount} frames...`);
                    
                    createSpriteSheetWithCanvas(result.frameFiles, outputFolder, currentCompInfo, folderName)
                        .then(outputResult => {
                            debug("JSON metadata created:", outputResult);
                            updateProgress(100, 'Complete!');
                            setStatus(`Export completed: ${frameCount} frames saved to ${folderName} folder`);
                        })
                        .catch(err => {
                            setStatus('Error creating JSON metadata: ' + err.message);
                            updateProgress(100, 'Error!');
                            console.error('JSON generation error:', err);
                            debug("JSON generation error:", err);
                        });
                } catch (err) {
                    setStatus('Error processing render results');
                    updateProgress(100, 'Error!');
                    console.error('Error processing render results:', err);
                    debug("Render result parse error:", err);
                }
            });
        } catch (err) {
            setStatus('Error processing folder result');
            debug("Folder result parse error:", err);
        }
    });
}

// Helper function to update progress bar
function updateProgress(percent, text) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (progressBar && progressText) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = text || `${percent}%`;
    }
}

// Generate JSON metadata for frames without creating a sprite sheet
async function createSpriteSheetWithCanvas(frameFiles, outputFolder, compInfo, folderName) {
    debug("Generating JSON metadata for frames:", frameFiles.length);
    
    // Add progress updates
    setStatus(`Processing ${frameFiles.length} frames...`);
    
    // Get frame dimensions from the composition
    const frameWidth = compInfo.width;
    const frameHeight = compInfo.height;
    const frameCount = frameFiles.length;
    
    // Array to store frame data for JSON
    const frameData = [];
    
    // Process each frame to extract metadata
    try {
        for (let i = 0; i < frameCount; i++) {
            // Update progress every 10 frames or at specific milestones
            if (i % 10 === 0 || i === frameCount - 1) {
                const percent = Math.floor(50 + (i / frameCount * 50)); // 50-100% range for this phase
                updateProgress(percent, `Processing frame ${i+1}/${frameCount}`);
                setStatus(`Processing frame metadata: ${i+1}/${frameCount}`);
            }
            
            // Get just the filename from the full path
            const fullPath = frameFiles[i];
            const fileName = path.basename(fullPath);
            
            // Add frame data to JSON
            frameData.push({
                frame: i,
                filename: fileName,
                width: frameWidth,
                height: frameHeight
            });
        }
    } catch (err) {
        debug("Error processing frames:", err);
        throw err;
    }
    
    // Use the provided folder name for the JSON filename
    const outputBaseName = folderName || path.basename(compInfo.name).replace(/\s+/g, '_');
    
    // Create JSON data
    const jsonData = {
        frames: frameData,
        meta: {
            frameCount: frameCount,
            framerate: compInfo.frameRate,
            originalName: compInfo.name,
            width: frameWidth,
            height: frameHeight
        }
    };
    
    // Create output file path for JSON
    const jsonPath = path.join(outputFolder, outputBaseName + '.json');
    
    debug("Output JSON file:", jsonPath);
    
    updateProgress(95, 'Saving metadata...');
    setStatus(`Saving metadata to: ${outputBaseName}.json`);
    
    // Write the JSON file
    try {
        fs.writeJsonSync(jsonPath, jsonData, { spaces: 2 });
        updateProgress(100, 'Complete!');
    } catch (err) {
        debug("Error saving JSON file:", err);
        throw err;
    }
    
    return {
        jsonPath,
        frameCount
    };
}

// Event listeners
updateBtn.addEventListener('click', updateCompInfo);
exportBtn.addEventListener('click', exportSpriteSheet);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    debug("Extension initialized");
    updateCompInfo();
}); 