// Include JSON polyfill for ExtendScript
//@include "json2.js"


// use this DOCS: 
// https://github.com/Adobe-CEP/Getting-Started-guides/tree/master/Exporting%20files%20from%20the%20host%20app
// https://ae-scripting.docsforadobe.dev/renderqueue/renderqueue/

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
    
    try {
        // Validate environment and composition
        if (!isAfterEffects()) {
            result.error = "This script requires Adobe After Effects";
            return JSON.stringify(result);
        }
        
        var comp = app.project.activeItem;
        if (!comp || !comp.duration) {
            result.error = "No active composition found";
            return JSON.stringify(result);
        }
        
        var frameCount = Math.floor(comp.duration * comp.frameRate);
        if (frameCount <= 0) {
            result.error = "Invalid frame count: " + frameCount;
            return JSON.stringify(result);
        }
        
        // Setup output folder
        var cleanCompName = comp.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        var tempFolderPath = outputFolder + "/" + cleanCompName + "_temp_frames";
        var tempFolder = new Folder(tempFolderPath);
        
        if (!tempFolder.exists && !tempFolder.create()) {
            result.error = "Failed to create temp directory: " + tempFolderPath;
            return JSON.stringify(result);
        }
        
        // Configure render queue
        var renderQueue = app.project.renderQueue;
        var renderQueueItem = renderQueue.items.add(comp);
        var outputModule = renderQueueItem.outputModules[1];
        
        // Apply PNG template (try each until one works)
        var templateApplied = applyPNGTemplate(outputModule, result);
        if (!templateApplied) {
            result.error = "Could not configure PNG sequence output";
            return JSON.stringify(result);
        }
        
        // Set output file path with AE sequence numbering
        // [#####] tells After Effects to create numbered files: name_00001.png, name_00002.png, etc.
        var sequencePattern = cleanCompName + "_[#####]";
        outputModule.file = new File(tempFolderPath + "/" + sequencePattern);
        
        // Render and wait for completion
        renderQueue.render();
        var renderResult = waitForRenderCompletion(renderQueueItem, result);
        if (renderResult.error) {
            return JSON.stringify(renderResult);
        }
        
        // Verify output files
        var pngCount = countPNGFiles(tempFolder);
        if (pngCount === 0) {
            result.error = "No PNG files were generated";
            return JSON.stringify(result);
        }
        
        result.debug.push("Generated " + pngCount + " PNG files");
        
        // Clean up and return success
        renderQueueItem.remove();
        
        result.tempFolder = tempFolderPath;
        result.frameCount = pngCount;
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

// Helper function to apply PNG template
function applyPNGTemplate(outputModule, result) {
    for (var i = 0; i < PNG_TEMPLATES.length; i++) {
        try {
            outputModule.applyTemplate(PNG_TEMPLATES[i]);
            var settings = outputModule.getSettings(GetSettingsFormat.STRING);
            if (settings && settings.Format && settings.Format.toLowerCase().indexOf("png sequence") !== -1) {
                result.debug.push("Applied PNG template: " + PNG_TEMPLATES[i]);
                return true;
            }
        } catch (e) {
            // Try next template
        }
    }
    return false;
}

// Helper function to wait for render completion
function waitForRenderCompletion(renderQueueItem, result) {
    var maxWaitTime = 300; // 5 minutes
    
    for (var waitTime = 0; waitTime < maxWaitTime; waitTime++) {
        var status = renderQueueItem.status;
        
        if (status === RQItemStatus.DONE) {
            result.debug.push("Render completed successfully");
            return {error: null};
        }
        
        if (status === RQItemStatus.FAILED) {
            return {error: "Render failed"};
        }
        
        if (status === RQItemStatus.STOPPED) {
            return {error: "Render was stopped"};
        }
        
        $.sleep(1000);
    }
    
    return {error: "Render timeout after " + maxWaitTime + " seconds"};
}

// Helper function to count PNG files in folder
function countPNGFiles(folder) {
    var allFiles = folder.getFiles("*");
    if (!allFiles) return 0;
    
    var pngCount = 0;
    for (var i = 0; i < allFiles.length; i++) {
        if (allFiles[i].name.toLowerCase().indexOf('.png') !== -1) {
            pngCount++;
        }
    }
    return pngCount;
}


