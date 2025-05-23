// Simple logging
function alert(message) {
    // Safer alert that won't interrupt the workflow
    $.writeln(message);
}

// Simple object to string formatter - no JSON dependency
function simpleStringify(obj) {
    try {
        if (obj === null) return "null";
        if (obj === undefined) return "undefined";
        
        // Handle primitive types
        var type = typeof obj;
        if (type === "string") return '"' + obj.replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
        if (type === "number" || type === "boolean") return String(obj);
        
        // Handle arrays
        if (obj instanceof Array) {
            var arrStr = "[";
            for (var i = 0; i < obj.length; i++) {
                arrStr += (i > 0 ? "," : "") + simpleStringify(obj[i]);
            }
            return arrStr + "]";
        }
        
        // Handle objects
        if (type === "object") {
            var objStr = "{";
            var first = true;
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (!first) objStr += ",";
                    first = false;
                    objStr += '"' + key + '":' + simpleStringify(obj[key]);
                }
            }
            return objStr + "}";
        }
        
        // Default for unsupported types
        return '""';
    } catch (e) {
        return '{"error":"Stringify error: ' + e.toString() + '"}';
    }
}

// Get information about the active composition - simplified version
function getActiveCompInfo() {
    // Initialize result object with default values
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
        // Make sure ExtendScript is working
        var testVar = 1 + 1;
        
        // Check if app object exists
        if (typeof app === "undefined") {
            result.error = "After Effects app object is not available";
            return simpleStringify(result);
        }
        
        // Check if project exists
        if (!app.project) {
            result.error = "No project is open";
            return simpleStringify(result);
        }
        
        // Check if active item exists
        var item = app.project.activeItem;
        if (!item) {
            result.error = "No active item selected";
            return simpleStringify(result);
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
            return simpleStringify(result);
        }
        
        if (!hasCompProperties) {
            result.error = "Selected item is not a composition";
            return simpleStringify(result);
        }
        
        // Get composition properties with type coercion and default values
        var name = String(item.name) || "Untitled";
        var width = parseInt(item.width, 10) || 1920;
        var height = parseInt(item.height, 10) || 1080;
        var frameRate = parseFloat(item.frameRate) || 30;
        var duration = parseFloat(item.duration) || 1;
        
        // Calculate frame count (Math.floor can be problematic in ExtendScript)
        var frameCount = parseInt(duration * frameRate, 10) || 1;
        
        // Update result object
        result.data = {
            id: 1, // Use constant ID as it's simpler
            name: name,
            width: width,
            height: height,
            frameCount: frameCount,
            frameRate: frameRate,
            duration: duration
        };
        
        // Clear error
        result.error = null;
    } catch (e) {
        result.error = "Error: " + e.toString();
    }
    
    return simpleStringify(result);
}

// Show folder picker and create a subfolder for sprite sheet export
function selectAndCreateExportFolder(defaultFolderName) {
    try {
        // First, select the parent directory
        var parentFolder = Folder.selectDialog("Select parent folder for sprite sheet export");
        if (!parentFolder) return "null";
        
        // Prompt for subfolder name with default
        var folderName = defaultFolderName || "sprite_sheet";
        folderName = folderName.replace(/\s+/g, '_');
        
        // Create the full path for the new subfolder
        var newFolderPath = parentFolder.fsName + "/" + folderName;
        var newFolder = new Folder(newFolderPath);
        
        // Create the folder if it doesn't exist
        if (!newFolder.exists) {
            var created = newFolder.create();
            if (!created) {
                alert("Failed to create folder: " + newFolderPath);
                return "null";
            }
        }
        
        // Return the folder path and name
        var result = {
            folderPath: newFolderPath,
            fileName: folderName
        };
        
        return simpleStringify(result);
    } catch (e) {
        alert("Error creating export folder: " + e.toString());
        return "null";
    }
}

// For backwards compatibility
function showSaveDialog(defaultName) {
    try {
        var defaultFilename = defaultName || "sprite_sheet";
        var suggestedName = defaultFilename.replace(/\s+/g, '_') + ".png";
        
        // Use File.saveDialog to get both path and filename
        var file = File.saveDialog("Save Sprite Sheet As", "PNG:*.png");
        
        if (!file) return "null";
        
        // Extract folder path and filename
        var folderPath = file.parent.fsName;
        var fileName = file.name;
        
        // Remove .png extension for consistent handling
        if (fileName.toLowerCase().indexOf('.png') !== -1) {
            fileName = fileName.substring(0, fileName.toLowerCase().indexOf('.png'));
        }
        
        // Return both folder path and filename as a JSON string
        var result = {
            folderPath: folderPath,
            fileName: fileName
        };
        
        return simpleStringify(result);
    } catch (e) {
        alert("Error in save dialog: " + e.toString());
        return "null";
    }
}

// For backwards compatibility
function showFolderPicker() {
    try {
        var folder = Folder.selectDialog("Select output folder for sprite sheet");
        return folder ? folder.fsName : "null";
    } catch (e) {
        alert("Error selecting folder: " + e.toString());
        return "null";
    }
}

// Render frames of the composition to PNGs directly to the specified output folder
function renderCompToImageSequence(options) {
    var result = {error: null, frameFiles: []};
    
    try {
        // Check for required objects
        if (typeof app === "undefined" || !app.project || !app.project.activeItem) {
            result.error = "No active composition";
            return simpleStringify(result);
        }
        
        // Get active composition
        var comp = app.project.activeItem;
        
        if (!comp || typeof comp.duration === "undefined") {
            result.error = "No active composition";
            return simpleStringify(result);
        }
        
        // Parse options with fallbacks
        if (typeof options === "string") {
            try {
                // Use eval since JSON.parse might not be available
                options = eval("(" + options + ")");
            } catch (e) {
                options = {outputDir: "~/Desktop"};
            }
        }
        
        // Create output directory
        var outputDir = new Folder(options.outputDir || "~/Desktop");
        if (!outputDir.exists) {
            var dirCreated = outputDir.create();
            if (!dirCreated) {
                result.error = "Failed to create output directory";
                return simpleStringify(result);
            }
        }
        
        // Use a direct approach to generate PNG frames - save directly from comp
        var frameDuration = 1.0 / comp.frameRate;
        var totalFrames = Math.floor(comp.duration * comp.frameRate);
        
        // Limit to a reasonable number of frames if needed
        totalFrames = Math.min(totalFrames, 300); // Max 300 frames to prevent performance issues
        
        // Suppress dialogs to prevent UI interruptions
        app.beginSuppressDialogs();
        
        // Generate a PNG for each frame
        var savedFrames = [];
        
        for (var i = 0; i < totalFrames; i++) {
            var time = i * frameDuration;
            var frameNum = i + 1;
            
            // Simple frame filename: frame_1.png, frame_2.png, etc.
            var frameFile = new File(outputDir.fsName + "/frame_" + frameNum + ".png");
            
            // Try to save the frame
            try {
                comp.saveFrameToPng(time, frameFile);
                savedFrames.push(frameFile.fsName);
            } catch (frameErr) {
                // Continue to next frame if there's an error
            }
        }
        
        // Re-enable dialogs
        app.endSuppressDialogs(false);
        
        if (savedFrames.length === 0) {
            // Fallback to an alternative method if direct saving failed
            result.error = "No frames were rendered. Please try rendering manually.";
            return simpleStringify(result);
        }
        
        // Success case
        result.frameFiles = savedFrames;
        
    } catch (e) {
        // Re-enable dialogs in case of error
        app.endSuppressDialogs(false);
        result.error = "Render error: " + e.toString();
    }
    
    return simpleStringify(result);
}

// Helper function to pad numbers with leading zeros
function padNumber(num, size) {
    var s = "00000" + num;
    return s.substr(s.length - size);
}

// Helper function to get a composition by ID
function getCompById(id) {
    try {
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            
            // Check if item is a composition and if ID matches
            if (item && item.typeName === "Composition" && item.id === id) {
                return item;
            }
        }
        
        // If composition not found by ID, return active composition as fallback
        var activeComp = app.project.activeItem;
        if (activeComp && activeComp.typeName === "Composition") {
            return activeComp;
        }
        
        return null;
    } catch (error) {
        alert("Error finding composition: " + error.toString());
        return null;
    }
}
