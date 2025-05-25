// Include JSON polyfill for ExtendScript
//@include "json2.js"

// Simple logging
function alert(message) {
    // Safer alert that won't interrupt the workflow
    $.writeln(message);
}

// PNG templates for After Effects
var PNG_TEMPLATES = ["_HIDDEN X-Factor 8", "_HIDDEN X-Factor 8 Premul", "_HIDDEN X-Factor 16", "_HIDDEN X-Factor 16 Premul"];

// Get information about the active composition
function getActiveCompInfo() {
    var result = {
        error: null,
        data: {
            id: 0,
            name: "Unknown",
            width: 0,
            height: 0,
            frameCount: 0,
            frameRate: 0,
            duration: 0
        }
    };
    
    try {
        // Check if app object exists
        if (typeof app === "undefined") {
            result.error = "After Effects app object is not available";
            return JSON.stringify(result);
        }
        
        // Check if project exists
        if (!app.project) {
            result.error = "No project is open";
            return JSON.stringify(result);
        }
        
        // Check if active item exists
        var item = app.project.activeItem;
        if (!item) {
            result.error = "No active item selected";
            return JSON.stringify(result);
        }
        
        // Check if the item has basic composition properties
        var hasCompProperties = false;
        
        try {
            hasCompProperties = (
                typeof item.name !== "undefined" &&
                typeof item.width !== "undefined" &&
                typeof item.height !== "undefined" &&
                typeof item.frameRate !== "undefined" &&
                typeof item.duration !== "undefined"
            );
        } catch (e) {
            result.error = "Selected item is not a composition";
            return JSON.stringify(result);
        }
        
        if (!hasCompProperties) {
            result.error = "Selected item is not a composition";
            return JSON.stringify(result);
        }
        
        // Get composition properties with type coercion and default values
        var name = String(item.name) || "Untitled";
        var width = parseInt(item.width, 10) || 1920;
        var height = parseInt(item.height, 10) || 1080;
        var frameRate = parseFloat(item.frameRate) || 30;
        var duration = parseFloat(item.duration) || 1;
        
        // Calculate frame count
        var frameCount = parseInt(duration * frameRate, 10) || 1;
        
        // Update result object
        result.data = {
            id: 1,
            name: name,
            width: width,
            height: height,
            frameCount: frameCount,
            frameRate: frameRate,
            duration: duration
        };
        
        result.error = null;
    } catch (e) {
        result.error = "Error: " + e.toString();
    }
    
    return JSON.stringify(result);
}

// Show folder picker for sprite sheet export
function selectExportFolder() {
    try {
        var folder = Folder.selectDialog("Select folder for sprite sheet export");
        if (!folder) return "null";
        
        return JSON.stringify({
            folderPath: folder.fsName
        });
    } catch (e) {
        alert("Error selecting export folder: " + e.toString());
        return "null";
    }
}

// Simple After Effects detection
function isAfterEffects() {
    return app && app.project && app.project.renderQueue;
}

// Export PNG sequence from After Effects composition
function renderCompositionToPNGSequence(outputFolder) {
    var result = {error: null, tempFolder: "", frameCount: 0, compInfo: null, debug: []};
    
    function addDebug(message) {
        result.debug.push(message);
    }
    
    try {
        // Basic checks
        if (!isAfterEffects()) {
            result.error = "This script requires Adobe After Effects";
            return JSON.stringify(result);
        }
        
        var comp = app.project.activeItem;
        if (!comp || !comp.duration) {
            result.error = "No active composition found";
            return JSON.stringify(result);
        }
        
        // Create temp folder for frames
        var cleanCompName = comp.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        var tempFolderPath = outputFolder + "/" + cleanCompName + "_temp_frames";
        var tempFolder = new Folder(tempFolderPath);
        
        if (!tempFolder.exists && !tempFolder.create()) {
                result.error = "Failed to create temp directory: " + tempFolderPath;
                return JSON.stringify(result);
        }
        
        var frameCount = Math.floor(comp.duration * comp.frameRate);
        if (frameCount <= 0) {
            result.error = "Invalid frame count: " + frameCount;
            return JSON.stringify(result);
        }
        
        // Add composition to render queue and configure PNG output
        var renderQueue = app.project.renderQueue;
        var renderQueueItem = renderQueue.items.add(comp);
        var outputModule = renderQueueItem.outputModules[1];
        
        // Try to apply PNG sequence template
        var templateApplied = false;
        
        for (var i = 0; i < PNG_TEMPLATES.length; i++) {
            try {
                outputModule.applyTemplate(PNG_TEMPLATES[i]);
                var settings = outputModule.getSettings(GetSettingsFormat.STRING);
                if (settings && settings.Format && settings.Format.toLowerCase().indexOf("png sequence") !== -1) {
                    addDebug("Applied PNG template: " + PNG_TEMPLATES[i]);
                    templateApplied = true;
                        break;
                }
            } catch (e) {
                // Try next template
                }
            }
            
            if (!templateApplied) {
            result.error = "Could not configure PNG sequence output";
            return JSON.stringify(result);
        }
        
        // Set output path
        var outputFileName = cleanCompName + "_[#####]";
            var outputFilePath = tempFolderPath + "/" + outputFileName;
                outputModule.file = new File(outputFilePath);
        
        // Start rendering and wait for completion
        renderQueue.render();
        
        var maxWaitTime = 300; // 5 minutes
        var waitTime = 0;
        
        while (waitTime < maxWaitTime) {
            var itemStatus = renderQueueItem.status;
            
                if (itemStatus === RQItemStatus.DONE) {
                addDebug("Render completed successfully");
                    break;
                } else if (itemStatus === RQItemStatus.FAILED) {
                result.error = "Render failed";
                return JSON.stringify(result);
                } else if (itemStatus === RQItemStatus.STOPPED) {
                    result.error = "Render was stopped";
                return JSON.stringify(result);
            }
            
            $.sleep(1000);
            waitTime += 1;
        }
        
        if (waitTime >= maxWaitTime) {
            result.error = "Render timeout after " + maxWaitTime + " seconds";
            return JSON.stringify(result);
        }
        
        // Check for generated files
        var allFiles = tempFolder.getFiles("*");
        if (!allFiles || allFiles.length === 0) {
            result.error = "No files were generated";
            return JSON.stringify(result);
        }
        
        // Count PNG files
        var pngFiles = [];
            for (var f = 0; f < allFiles.length; f++) {
            var fileName = allFiles[f].name;
            if (fileName.toLowerCase().indexOf('.png') !== -1) {
                pngFiles.push(fileName);
            }
        }
        
        if (pngFiles.length === 0) {
            result.error = "No PNG files were generated";
            return JSON.stringify(result);
        }
        
        addDebug("Generated " + pngFiles.length + " PNG files");
        
        // Clean up render queue
        renderQueueItem.remove();
        
        // Return success
        result.tempFolder = tempFolderPath;
        result.frameCount = pngFiles.length;
        result.compInfo = {
            name: comp.name,
            width: comp.width,
            height: comp.height,
            frameRate: comp.frameRate,
            duration: comp.duration,
            frameCount: frameCount
        };
        
        return JSON.stringify(result);
        
    } catch (e) {
        result.error = "Export error: " + e.toString();
        return JSON.stringify(result);
    }
}


