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
            var created = outputDir.create();
            if (!created) {
                result.error = "Failed to create output directory";
                return simpleStringify(result);
            }
        }
        
        // Get composition settings
        var frameRate = comp.frameRate;
        var duration = comp.duration;
        var frameCount = Math.floor(duration * frameRate);
        var frameDuration = 1 / frameRate;
        
        // Array to store rendered file paths
        var frameFiles = [];
        
        // Loop through each frame and render
        for (var i = 0; i < frameCount; i++) {
            // Calculate the time for this frame
            var frameTime = i * frameDuration;
            
            // Create filename with padding
            var frameNumber = padNumber(i, 4);
            var fileName = "frame_" + frameNumber + ".png";
            var filePath = outputDir.fsName + "/" + fileName;
            
            // Create file object
            var file = new File(filePath);
            
            // Set current time to render frame accurately
            comp.time = frameTime;
            
            // Render the frame
            comp.saveFrameToPng(frameTime, file);
            
            // Add to our list
            frameFiles.push(filePath);
        }
        
        // Update result
        result.frameFiles = frameFiles;
        
        // Return success
        return simpleStringify(result);
    } catch (e) {
        result.error = "Error rendering frames: " + e.toString();
        return simpleStringify(result);
    }
}

// Helper function to pad numbers with leading zeros
function padNumber(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length - size);
}
