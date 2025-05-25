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
    
    return simpleStringify(result);
}

// Show folder picker for sprite sheet export
function selectExportFolder() {
    try {
        var folder = Folder.selectDialog("Select folder for sprite sheet export");
        if (!folder) return "null";
        
        return simpleStringify({
            folderPath: folder.fsName
        });
    } catch (e) {
        alert("Error selecting export folder: " + e.toString());
        return "null";
    }
}

// Helper function to determine export method based on Adobe application
function getExportMethod() {
    if (typeof app === "undefined") {
        return {error: "Adobe application not available", method: null};
    }
    
    // Try multiple methods to detect After Effects
    var appName = "Unknown";
    var isAfterEffects = false;
    
    // Method 1: Check app.name
    if (typeof app.name !== "undefined" && app.name !== null) {
        appName = String(app.name);
        if (appName.indexOf("After Effects") !== -1) {
            isAfterEffects = true;
        }
    }
    
    // Method 2: Check if we have After Effects specific objects
    if (!isAfterEffects) {
        try {
            if (app.project && app.project.renderQueue && typeof app.project.renderQueue.render === "function") {
                isAfterEffects = true;
                appName = "Adobe After Effects (detected via renderQueue)";
            }
        } catch (e) {
            // Ignore error
        }
    }
    
    // Method 3: Check for After Effects specific properties/methods
    if (!isAfterEffects) {
        try {
            if (app.project && app.project.activeItem && typeof app.project.activeItem.frameRate !== "undefined") {
                isAfterEffects = true;
                appName = "Adobe After Effects (detected via composition)";
            }
        } catch (e) {
            // Ignore error
        }
    }
    
    // If we detected After Effects by any method, return success
    if (isAfterEffects) {
        return {
            error: null,
            method: "aftereffects",
            appName: appName,
            exportType: "ae_saveframepng"
        };
    }
    
    // If app.name exists but isn't After Effects, check other Adobe apps
    if (typeof app.name !== "undefined" && app.name !== null) {
        appName = String(app.name);
        
        if (appName.indexOf("Adobe Illustrator") !== -1) {
            return {
                error: null,
                method: "illustrator",
                appName: "Adobe Illustrator",
                exportType: "ai_export"
            };
        } else if (appName.indexOf("Adobe Photoshop") !== -1) {
            return {
                error: null,
                method: "photoshop",
                appName: "Adobe Photoshop",
                exportType: "ps_export"
            };
        } else if (appName.indexOf("Adobe InDesign") !== -1) {
            return {
                error: null,
                method: "indesign", 
                appName: "Adobe InDesign",
                exportType: "id_export"
            };
        }
    }
    
    // Fallback error
    return {
        error: "Could not detect Adobe application type. App name: " + appName,
        method: null,
        appName: appName
    };
}

// Export frames using the Render Queue API with PNG sequence output
function renderCompositionToPNGSequence(outputFolder) {
    var result = {error: null, tempFolder: "", frameCount: 0, compInfo: null, debug: []};
    
    function addDebug(message) {
        result.debug.push(message);
        // Don't use $.writeln here as it mixes with JSON response
    }
    
    try {
        // Check which Adobe application we're running in
        var exportMethod = getExportMethod();
        
        addDebug("=== APPLICATION CHECK ===");
        if (exportMethod.error) {
            result.error = exportMethod.error;
            addDebug("ERROR: " + exportMethod.error);
            return simpleStringify(result);
        }
        
        addDebug("Application detected: " + exportMethod.appName);
        addDebug("Export method: " + exportMethod.exportType);
        
        // Verify we're in After Effects (this script is AE-specific)
        if (exportMethod.method !== "aftereffects") {
            result.error = "This script is designed for Adobe After Effects only. Current app: " + exportMethod.appName;
            addDebug("ERROR: Wrong application - expected After Effects, got: " + exportMethod.appName);
            return simpleStringify(result);
        }
        
        addDebug("✅ Confirmed running in After Effects - using Render Queue API");
        
        // Check for required objects (After Effects specific)
        if (!app.project || !app.project.activeItem) {
            result.error = "No active composition in After Effects";
            return simpleStringify(result);
        }
        
        // Get active composition
        var comp = app.project.activeItem;
        
        if (!comp) {
            result.error = "No active composition";
            return simpleStringify(result);
        }
        
        // Validate we have a render queue
        if (!app.project.renderQueue) {
            result.error = "Render Queue not available";
            addDebug("ERROR: app.project.renderQueue is not available");
            return simpleStringify(result);
        }
        
        // Safely check composition properties
        try {
            var isValidComp = (
                typeof comp.duration !== "undefined" && 
                typeof comp.name !== "undefined" && 
                typeof comp.frameRate !== "undefined" &&
                typeof comp.width !== "undefined" &&
                typeof comp.height !== "undefined"
            );
            
            if (!isValidComp) {
                result.error = "Active item is not a valid composition (missing required properties)";
                return simpleStringify(result);
            }
            
            addDebug("Composition validation passed - all required properties exist");
            
        } catch (compError) {
            result.error = "Error accessing composition properties: " + compError.toString();
            return simpleStringify(result);
        }
        
        addDebug("=== STARTING RENDER QUEUE PNG EXPORT ===");
        addDebug("Composition: " + comp.name);
        addDebug("Duration: " + comp.duration + "s");
        addDebug("Frame rate: " + comp.frameRate);
        addDebug("Dimensions: " + comp.width + "x" + comp.height);
        
        // Clean composition name for folder creation
        var cleanCompName = comp.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        // Create temporary folder for PNG sequence
        var tempFolderPath = outputFolder + "/" + cleanCompName + "_temp_frames";
        var tempFolder = new Folder(tempFolderPath);
        
        if (!tempFolder.exists) {
            var created = tempFolder.create();
            if (!created) {
                result.error = "Failed to create temp directory: " + tempFolderPath;
                return simpleStringify(result);
            }
        }
        
        addDebug("Created temp folder: " + tempFolderPath);
        
        // Calculate frame count and validate
        var frameCount = Math.floor(comp.duration * comp.frameRate);
        addDebug("Calculated frame count: " + frameCount);
        
        if (frameCount <= 0) {
            result.error = "Invalid frame count: " + frameCount;
            return simpleStringify(result);
        }
        
        // Get render queue
        var renderQueue = app.project.renderQueue;
        addDebug("Render queue items before: " + renderQueue.items.length);
        
        // Add composition to render queue
        var renderQueueItem = renderQueue.items.add(comp);
        addDebug("Added composition to render queue");
        
        // IMMEDIATELY apply PNG template before any other operations
        addDebug("=== FORCING PNG TEMPLATE APPLICATION ===");
        try {
            // Get the output module right away
            var outputModule = renderQueueItem.outputModules[1]; // 1-indexed in ExtendScript
            
            if (!outputModule) {
                result.error = "Could not access output module";
                return simpleStringify(result);
            }
            
            // Get available templates for debugging
            var availableTemplates = outputModule.templates || [];
            addDebug("Available templates: " + availableTemplates.join(", "));
            addDebug("Total templates found: " + availableTemplates.length);
            
            // Show ALL available templates in detail
            addDebug("=== COMPREHENSIVE TEMPLATE ANALYSIS ===");
            addDebug("Analyzing each template to understand output formats and capabilities...");
            
            // Store template analysis results
            var templateAnalysis = [];
            
            for (var i = 0; i < availableTemplates.length; i++) {
                var templateName = availableTemplates[i];
                addDebug("--- Template " + (i + 1) + "/" + availableTemplates.length + ": '" + templateName + "' ---");
                
                var templateInfo = {
                    name: templateName,
                    index: i + 1,
                    canApply: false,
                    format: "unknown",
                    extension: "unknown",
                    hasAlpha: false,
                    isSequence: false,
                    isImageFormat: false,
                    isVideoFormat: false,
                    notes: []
                };
                
                // Try to apply each template and see what format it produces
                try {
                    var testModule = renderQueueItem.outputModules[1];
                    testModule.applyTemplate(templateName);
                    templateInfo.canApply = true;
                    addDebug("  ✅ Template applies successfully");
                    
                    // Try to get detailed settings using the proper API
                    try {
                        var testSettings = testModule.getSettings(GetSettingsFormat.STRING);
                        if (testSettings) {
                            // Log all available settings for this template
                            addDebug("  📋 Available settings:");
                            for (var settingKey in testSettings) {
                                if (testSettings.hasOwnProperty(settingKey)) {
                                    var settingValue = testSettings[settingKey];
                                    addDebug("    " + settingKey + ": " + settingValue);
                                }
                            }
                            
                            if (testSettings.Format) {
                                templateInfo.format = testSettings.Format;
                                addDebug("  📄 Format: " + testSettings.Format);
                                
                                // Analyze format characteristics
                                var formatLower = testSettings.Format.toLowerCase();
                                if (formatLower.indexOf("png") !== -1) {
                                    templateInfo.extension = "png";
                                    templateInfo.isImageFormat = true;
                                    templateInfo.notes.push("PNG format - Canvas compatible");
                                } else if (formatLower.indexOf("tiff") !== -1 || formatLower.indexOf("tif") !== -1) {
                                    templateInfo.extension = "tiff";
                                    templateInfo.isImageFormat = true;
                                    templateInfo.notes.push("TIFF format - Requires conversion for Canvas");
                                } else if (formatLower.indexOf("photoshop") !== -1 || formatLower.indexOf("psd") !== -1) {
                                    templateInfo.extension = "psd";
                                    templateInfo.isImageFormat = true;
                                    templateInfo.notes.push("PSD format - Requires conversion for Canvas");
                                } else if (formatLower.indexOf("jpeg") !== -1 || formatLower.indexOf("jpg") !== -1) {
                                    templateInfo.extension = "jpeg";
                                    templateInfo.isImageFormat = true;
                                    templateInfo.notes.push("JPEG format - Canvas compatible but lossy");
                                } else if (formatLower.indexOf("quicktime") !== -1 || formatLower.indexOf("mov") !== -1) {
                                    templateInfo.extension = "mov";
                                    templateInfo.isVideoFormat = true;
                                    templateInfo.notes.push("QuickTime video format - Not suitable for sprite sheets");
                                } else if (formatLower.indexOf("h.264") !== -1 || formatLower.indexOf("mp4") !== -1) {
                                    templateInfo.extension = "mp4";
                                    templateInfo.isVideoFormat = true;
                                    templateInfo.notes.push("H.264/MP4 video format - Not suitable for sprite sheets");
                                } else if (formatLower.indexOf("avi") !== -1) {
                                    templateInfo.extension = "avi";
                                    templateInfo.isVideoFormat = true;
                                    templateInfo.notes.push("AVI video format - Not suitable for sprite sheets");
                                }
                                
                                // Check for alpha/transparency support
                                if (formatLower.indexOf("alpha") !== -1 || 
                                    templateName.toLowerCase().indexOf("alpha") !== -1) {
                                    templateInfo.hasAlpha = true;
                                    templateInfo.notes.push("Supports transparency/alpha channel");
                                }
                                
                                // Check if it's a sequence format
                                if (templateName.toLowerCase().indexOf("sequence") !== -1 ||
                                    formatLower.indexOf("sequence") !== -1) {
                                    templateInfo.isSequence = true;
                                    templateInfo.notes.push("Image sequence format - Perfect for sprite sheets");
                                }
                            }
                            
                            // Check for additional format indicators
                            if (testSettings["Output File Info"]) {
                                var fileInfo = testSettings["Output File Info"];
                                addDebug("  📁 File Info:");
                                for (var fileKey in fileInfo) {
                                    if (fileInfo.hasOwnProperty(fileKey)) {
                                        addDebug("    " + fileKey + ": " + fileInfo[fileKey]);
                                    }
                                }
                                
                                // Check file template for sequence indicators
                                if (fileInfo["File Template"] && 
                                    fileInfo["File Template"].indexOf("[#") !== -1) {
                                    templateInfo.isSequence = true;
                                    templateInfo.notes.push("Sequence numbering detected in file template");
                                }
                            }
                            
                            // Try to access additional properties
                            if (testSettings.Channels) {
                                addDebug("  🎨 Channels: " + testSettings.Channels);
                            }
                            if (testSettings.Depth) {
                                addDebug("  🔢 Bit Depth: " + testSettings.Depth);
                            }
                            if (testSettings.Quality) {
                                addDebug("  ⭐ Quality: " + testSettings.Quality);
                            }
                            
                        } else {
                            addDebug("  ⚠️ Could not get template settings");
                            templateInfo.notes.push("Settings not accessible");
                        }
                    } catch (settingsError) {
                        addDebug("  ❌ Settings error: " + settingsError.toString());
                        templateInfo.notes.push("Settings error: " + settingsError.message);
                    }
                    
                } catch (testError) {
                    addDebug("  ❌ Template failed to apply: " + testError.toString());
                    templateInfo.canApply = false;
                    templateInfo.notes.push("Cannot apply: " + testError.message);
                }
                
                // Add notes based on template name analysis
                var templateNameLower = templateName.toLowerCase();
                if (templateNameLower.indexOf("lossless") !== -1) {
                    templateInfo.notes.push("Lossless compression - High quality");
                }
                if (templateNameLower.indexOf("high quality") !== -1) {
                    templateInfo.notes.push("High quality preset");
                }
                if (templateNameLower.indexOf("web") !== -1) {
                    templateInfo.notes.push("Web-optimized format");
                }
                if (templateNameLower.indexOf("png") !== -1) {
                    templateInfo.extension = "png";
                    templateInfo.isImageFormat = true;
                    templateInfo.notes.push("PNG in template name");
                }
                if (templateNameLower.indexOf("tiff") !== -1) {
                    templateInfo.extension = "tiff";
                    templateInfo.isImageFormat = true;
                    templateInfo.notes.push("TIFF in template name");
                }
                
                // Summary for this template
                var formatType = templateInfo.isVideoFormat ? "Video" : 
                               templateInfo.isImageFormat ? "Image" : "Unknown";
                addDebug("  📊 Summary: " + formatType + 
                        " | " + (templateInfo.canApply ? "Usable" : "Cannot apply") + 
                        " | " + (templateInfo.hasAlpha ? "With Alpha" : "No Alpha") + 
                        " | " + (templateInfo.isSequence ? "Sequence" : "Single") +
                        " | Extension: " + templateInfo.extension);
                
                if (templateInfo.notes.length > 0) {
                    addDebug("  📝 Notes: " + templateInfo.notes.join("; "));
                }
                
                templateAnalysis.push(templateInfo);
                addDebug(""); // Empty line for readability
            }
            
            // Summary report
            addDebug("=== TEMPLATE ANALYSIS SUMMARY ===");
            var usableImageTemplates = [];
            var pngTemplates = [];
            var alphaTemplates = [];
            var sequenceTemplates = [];
            var videoTemplates = [];
            
            // ES3-compatible filtering using for loops
            for (var j = 0; j < templateAnalysis.length; j++) {
                var t = templateAnalysis[j];
                if (t.canApply && t.isImageFormat) {
                    usableImageTemplates.push(t);
                }
                if (t.canApply && t.extension === "png") {
                    pngTemplates.push(t);
                }
                if (t.canApply && t.hasAlpha) {
                    alphaTemplates.push(t);
                }
                if (t.canApply && t.isSequence) {
                    sequenceTemplates.push(t);
                }
                if (t.canApply && t.isVideoFormat) {
                    videoTemplates.push(t);
                }
            }
            
            addDebug("📈 Template Statistics:");
            addDebug("  Total templates: " + availableTemplates.length);
            addDebug("  Usable image templates: " + usableImageTemplates.length);
            addDebug("  PNG templates: " + pngTemplates.length);
            addDebug("  Alpha-capable templates: " + alphaTemplates.length);
            addDebug("  Sequence templates: " + sequenceTemplates.length);
            addDebug("  Video templates: " + videoTemplates.length + " (will be avoided)");
            
            if (pngTemplates.length > 0) {
                addDebug("🎯 Best PNG options:");
                for (var p = 0; p < pngTemplates.length; p++) {
                    var pngTemplate = pngTemplates[p];
                    addDebug("  • " + pngTemplate.name + " (Index: " + pngTemplate.index + ")");
                }
            }
            
            if (sequenceTemplates.length > 0) {
                addDebug("📸 Sequence-capable options:");
                for (var s = 0; s < sequenceTemplates.length; s++) {
                    var seqTemplate = sequenceTemplates[s];
                    addDebug("  • " + seqTemplate.name + " (" + seqTemplate.extension + ")");
                }
            }
            
            if (videoTemplates.length > 0) {
                addDebug("🎬 Video templates (will be avoided):");
                for (var v = 0; v < videoTemplates.length; v++) {
                    var videoTemplate = videoTemplates[v];
                    addDebug("  • " + videoTemplate.name + " (" + videoTemplate.extension + ")");
                }
            }
            
            // Reset to default template before proceeding
            try {
                if (availableTemplates.indexOf("Lossless") !== -1) {
                    outputModule.applyTemplate("Lossless");
                    addDebug("Reset to Lossless template as baseline");
                }
            } catch (resetError) {
                addDebug("Could not reset to baseline template: " + resetError.toString());
            }
            
            addDebug("=== ATTEMPTING IMAGE FORMAT CONFIGURATION ===");
            
            // Apply image format template - prioritize PNG sequences for Canvas compatibility
            var templateApplied = false;
            var appliedTemplateName = "";
            
            // Step 1: Try PNG sequence templates first (best for Canvas)
            var pngSequenceTemplates = [];
            for (var i = 0; i < templateAnalysis.length; i++) {
                var template = templateAnalysis[i];
                if (template.canApply && template.format && 
                    template.format.toLowerCase().indexOf("png sequence") !== -1) {
                    pngSequenceTemplates.push(template.name);
                }
            }
            
            // Step 2: Try other PNG templates
            var otherPngTemplates = [];
            for (var i = 0; i < templateAnalysis.length; i++) {
                var template = templateAnalysis[i];
                if (template.canApply && template.format && 
                    template.format.toLowerCase().indexOf("png") !== -1 &&
                    template.format.toLowerCase().indexOf("sequence") === -1) {
                    otherPngTemplates.push(template.name);
                }
            }
            
            // Step 3: Try other image sequence templates (TIFF, etc.)
            var otherImageSequenceTemplates = [];
            for (var i = 0; i < templateAnalysis.length; i++) {
                var template = templateAnalysis[i];
                if (template.canApply && template.isImageFormat && template.isSequence && template.extension !== "png") {
                    otherImageSequenceTemplates.push(template.name);
                }
            }
            
            // Step 4: Manual template names as fallback - prioritize PNG formats
            var manualImageTemplateOptions = [
                // Hidden PNG templates (discovered in AE)
                "_HIDDEN X-Factor 8",        // PNG Sequence - 8-bit
                "_HIDDEN X-Factor 8 Premul", // PNG Sequence - 8-bit premultiplied
                "_HIDDEN X-Factor 16",       // PNG Sequence - 16-bit
                "_HIDDEN X-Factor 16 Premul", // PNG Sequence - 16-bit premultiplied
                // Standard PNG templates (if they exist)
                "PNG Sequence",              
                "PNG Sequence with Alpha",   
                "PNG",
                "PNG with Alpha",
                "Lossless with Alpha",       // Often PNG
                "Lossless",                  // Often PNG
                "High Quality with Alpha",   // Might be PNG
                "High Quality",              // Might be PNG
                "Photoshop Sequence",        // Last resort
                "TIFF Sequence",             // Last resort
                "TIFF Sequence with Alpha"   // Last resort
            ];
            
            // Build prioritized template list - heavily favor PNG for Canvas compatibility
            var prioritizedTemplates = []
                .concat(pngSequenceTemplates)
                .concat(otherPngTemplates)
                .concat(manualImageTemplateOptions)  // Move manual PNG options before other formats
                .concat(otherImageSequenceTemplates);
            
            // Remove duplicates while preserving order
            var uniqueTemplates = [];
            for (var i = 0; i < prioritizedTemplates.length; i++) {
                var template = prioritizedTemplates[i];
                var isDuplicate = false;
                for (var j = 0; j < uniqueTemplates.length; j++) {
                    if (uniqueTemplates[j] === template) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    uniqueTemplates.push(template);
                }
            }
            
            // Add the actual available templates from this AE installation
            var availableImageTemplates = [
                "Lossless",                    // Likely PNG - best option
                "Lossless with Alpha",         // PNG with transparency
                "High Quality",                // Might be PNG or JPEG
                "High Quality with Alpha",     // Might be PNG with transparency
                "TIFF Sequence with Alpha",    // Image sequence (TIFF)
                "Photoshop",                   // PSD format
                "Alpha Only"                   // Alpha channel only
            ];
            
            // Merge with existing unique templates, avoiding duplicates
            for (var k = 0; k < availableImageTemplates.length; k++) {
                var availableTemplate = availableImageTemplates[k];
                var alreadyExists = false;
                for (var l = 0; l < uniqueTemplates.length; l++) {
                    if (uniqueTemplates[l] === availableTemplate) {
                        alreadyExists = true;
                        break;
                    }
                }
                if (!alreadyExists) {
                    uniqueTemplates.push(availableTemplate);
                }
            }
            
            addDebug("🎯 TEMPLATE SELECTION STRATEGY:");
            addDebug("Will try templates in this priority order:");
            addDebug("1. PNG Sequences: " + pngSequenceTemplates.join(", "));
            addDebug("2. Other PNG Templates: " + otherPngTemplates.join(", "));
            addDebug("3. Other Image Sequences: " + otherImageSequenceTemplates.join(", "));
            addDebug("4. Manual Fallbacks: " + manualImageTemplateOptions.join(", "));
            addDebug("5. Available AE Templates: " + availableImageTemplates.join(", "));
            addDebug("Final prioritized list: " + uniqueTemplates.join(", "));
            
            for (var t = 0; t < uniqueTemplates.length; t++) {
                var templateName = uniqueTemplates[t];
                
                // Check if this template exists in available templates
                var templateExists = false;
                for (var a = 0; a < availableTemplates.length; a++) {
                    if (availableTemplates[a] === templateName) {
                        templateExists = true;
                        break;
                    }
                }
                
                if (templateExists) {
                    try {
                        addDebug("Trying to apply template: " + templateName);
                        outputModule.applyTemplate(templateName);
                        appliedTemplateName = templateName;
                        templateApplied = true;
                        addDebug("✅ Successfully applied template: " + templateName);
                        
                        // Verify what format we got and validate it's Canvas-compatible
                        try {
                            var appliedSettings = outputModule.getSettings(GetSettingsFormat.STRING);
                            if (appliedSettings && appliedSettings.Format) {
                                addDebug("Template resulted in format: " + appliedSettings.Format);
                                
                                // Check if this is a Canvas-compatible format
                                var formatLower = appliedSettings.Format.toLowerCase();
                                var isCanvasCompatible = (
                                    formatLower.indexOf("png") !== -1 ||
                                    formatLower.indexOf("jpeg") !== -1 ||
                                    formatLower.indexOf("jpg") !== -1
                                );
                                
                                var isVideoFormat = (
                                    formatLower.indexOf("quicktime") !== -1 ||
                                    formatLower.indexOf("mov") !== -1 ||
                                    formatLower.indexOf("h.264") !== -1 ||
                                    formatLower.indexOf("mp4") !== -1 ||
                                    formatLower.indexOf("avi") !== -1
                                );
                                
                                var isTiffOrPsd = (
                                    formatLower.indexOf("tiff") !== -1 ||
                                    formatLower.indexOf("tif") !== -1 ||
                                    formatLower.indexOf("photoshop") !== -1 ||
                                    formatLower.indexOf("psd") !== -1
                                );
                                
                                if (isVideoFormat) {
                                    addDebug("❌ Template produces video format: " + appliedSettings.Format);
                                    addDebug("   Video formats cannot be used for sprite sheet generation");
                                    templateApplied = false;
                                    continue; // Try next template
                                } else if (isTiffOrPsd) {
                                    addDebug("⚠️ Template produces TIFF/PSD format: " + appliedSettings.Format);
                                    addDebug("   TIFF/PSD formats will require Sharp for processing");
                                    addDebug("   Proceeding anyway - will handle format conversion in client");
                                    // Don't reject TIFF/PSD - let the client handle it
                                } else if (isCanvasCompatible) {
                                    addDebug("✅ Confirmed Canvas-compatible format: " + appliedSettings.Format);
                                } else {
                                    addDebug("⚠️ Unknown format compatibility: " + appliedSettings.Format);
                                    addDebug("   Will proceed but Canvas fallback may fail");
                                }
                                
                                // Check if it's a sequence
                                var isSequence = false;
                                if (appliedSettings["Output File Info"]) {
                                    var fileInfo = appliedSettings["Output File Info"];
                                    if (fileInfo["File Template"] && 
                                        fileInfo["File Template"].indexOf("[#") !== -1) {
                                        isSequence = true;
                                        addDebug("✅ Confirmed sequence format with numbering: " + fileInfo["File Template"]);
                                    }
                                }
                                
                                if (!isSequence) {
                                    addDebug("⚠️ This template may not produce a sequence - looking for [#] numbering pattern");
                                }
                                
                                // Log additional settings for debugging
                                if (appliedSettings["Output Channels"]) {
                                    addDebug("Output Channels: " + appliedSettings["Output Channels"]);
                                }
                                if (appliedSettings["Color Depth"]) {
                                    addDebug("Color Depth: " + appliedSettings["Color Depth"]);
                                }
                                if (appliedSettings["Format Options"]) {
                                    addDebug("Format Options: " + appliedSettings["Format Options"]);
                                }
                            }
                        } catch (e) {
                            addDebug("Could not verify applied format: " + e.toString());
                        }
                        
                        break; // Success, stop trying other templates
                        
                    } catch (applyError) {
                        addDebug("Failed to apply template '" + templateName + "': " + applyError.toString());
                        continue;
                    }
                } else {
                    addDebug("Template '" + templateName + "' not available");
                }
            }
            
            if (!templateApplied) {
                result.error = "Could not configure any image output template. Available templates: " + availableTemplates.join(", ");
                return simpleStringify(result);
            }
            
            addDebug("=== FINAL TEMPLATE CONFIGURATION ===");
            addDebug("Applied template: " + appliedTemplateName);
            
            // Get final template settings for verification
            try {
                var finalTemplateSettings = outputModule.getSettings(GetSettingsFormat.STRING);
                if (finalTemplateSettings) {
                    addDebug("Final template settings:");
                    for (var settingKey in finalTemplateSettings) {
                        if (finalTemplateSettings.hasOwnProperty(settingKey)) {
                            addDebug("  " + settingKey + ": " + finalTemplateSettings[settingKey]);
                        }
                    }
                }
            } catch (finalSettingsError) {
                addDebug("Could not get final template settings: " + finalSettingsError.toString());
            }
            
        } catch (templateError) {
            result.error = "Failed to configure PNG template: " + templateError.toString();
            addDebug("ERROR: Template configuration failed: " + templateError.toString());
            return simpleStringify(result);
        }
        
        // Configure the render queue item for PNG sequence output
        try {
            // Re-get the output module to ensure we have the updated one
            outputModule = renderQueueItem.outputModules[1];
            
            if (!outputModule) {
                result.error = "Could not access output module after template application";
                return simpleStringify(result);
            }
            
            addDebug("=== CONFIGURING OUTPUT PATH ===");
            
            // Set output file path and naming
            var outputFileName = cleanCompName + "_[#####]"; // Frame padding
            var outputFilePath = tempFolderPath + "/" + outputFileName;
            
            try {
                outputModule.file = new File(outputFilePath);
                addDebug("✅ Set output path: " + outputFilePath);
            } catch (pathError) {
                result.error = "Failed to set output path: " + pathError.toString();
                return simpleStringify(result);
            }
            
            // Log current output module settings for debugging
            try {
                addDebug("=== OUTPUT MODULE SETTINGS ===");
                addDebug("Format: " + outputModule.format);
                addDebug("File: " + outputModule.file.fsName);
                addDebug("Name: " + outputModule.name);
                
                // Try to access format options if available
                try {
                    var formatOptions = outputModule.formatOptions;
                    if (formatOptions) {
                        addDebug("Format options available");
                    }
                } catch (e) {
                    addDebug("Format options not accessible");
                }
                
            } catch (debugError) {
                addDebug("Could not read output module settings: " + debugError.toString());
            }
            
        } catch (outputModuleError) {
            result.error = "Failed to configure output module: " + outputModuleError.toString();
            addDebug("ERROR: Output module configuration failed: " + outputModuleError.toString());
            return simpleStringify(result);
        }
        
        // Start rendering
        addDebug("=== STARTING RENDER ===");
        addDebug("Render queue items: " + renderQueue.items.length);
        
        // Final verification of output format before rendering
        try {
            var finalOutputModule = renderQueueItem.outputModules[1];
            var finalSettings = finalOutputModule.getSettings(GetSettingsFormat.STRING);
            if (finalSettings && finalSettings.Format) {
                addDebug("=== FINAL FORMAT VERIFICATION ===");
                addDebug("Final output format: " + finalSettings.Format);
                addDebug("Output file: " + finalOutputModule.file.fsName);
                addDebug("✅ Image format configured - will convert to PNG/WebP in sprite sheet");
            }
        } catch (verifyError) {
            addDebug("Could not verify final format: " + verifyError.toString());
        }
        
        try {
            // Start the render
            renderQueue.render();
            addDebug("✅ Render queue started");
            
            // Wait for render to complete
            var renderComplete = false;
            var maxWaitTime = 300; // 5 minutes max
            var waitTime = 0;
            var checkInterval = 1; // Check every second
            
            addDebug("Waiting for render to complete...");
            
            while (!renderComplete && waitTime < maxWaitTime) {
                // Check render status
                var queueStatus = renderQueue.status;
                var itemStatus = renderQueueItem.status;
                
                // More detailed status logging every 5 seconds
                if (waitTime % 5 === 0) {
                    addDebug("Status check at " + waitTime + "s:");
                    addDebug("  Queue rendering: " + renderQueue.rendering);
                    addDebug("  Queue status: " + queueStatus);
                    addDebug("  Item status: " + itemStatus);
                    
                    // Try to get additional status information
                    try {
                        if (renderQueueItem.elapsedSeconds !== undefined) {
                            addDebug("  Elapsed seconds: " + renderQueueItem.elapsedSeconds);
                        }
                        if (renderQueueItem.startTime !== undefined) {
                            addDebug("  Start time: " + renderQueueItem.startTime);
                        }
                    } catch (statusError) {
                        // Some properties might not be available
                    }
                }
                
                // Check if render is complete
                if (itemStatus === RQItemStatus.DONE) {
                    renderComplete = true;
                    addDebug("✅ Render completed successfully");
                    addDebug("Final item status: " + itemStatus);
                    addDebug("Total render time: " + waitTime + " seconds");
                    break;
                } else if (itemStatus === RQItemStatus.FAILED) {
                    result.error = "Render failed - check After Effects render queue for details";
                    addDebug("❌ Render failed");
                    addDebug("Final item status: " + itemStatus);
                    
                    // Try to get more error information
                    try {
                        var itemSettings = renderQueueItem.getSettings(GetSettingsFormat.STRING);
                        if (itemSettings) {
                            addDebug("Item settings at failure:");
                            for (var errorKey in itemSettings) {
                                if (itemSettings.hasOwnProperty(errorKey)) {
                                    addDebug("  " + errorKey + ": " + itemSettings[errorKey]);
                                }
                            }
                        }
                    } catch (errorDetailsError) {
                        addDebug("Could not get error details: " + errorDetailsError.toString());
                    }
                    
                    break;
                } else if (itemStatus === RQItemStatus.STOPPED) {
                    result.error = "Render was stopped";
                    addDebug("⏹️ Render was stopped");
                    addDebug("Final item status: " + itemStatus);
                    break;
                } else if (itemStatus === RQItemStatus.QUEUED) {
                    // Still queued, waiting to start
                    if (waitTime % 10 === 0) {
                        addDebug("Still queued, waiting to start... (" + waitTime + "s elapsed)");
                    }
                } else if (itemStatus === RQItemStatus.RENDERING) {
                    // Currently rendering
                    if (waitTime % 10 === 0) {
                        addDebug("Actively rendering... (" + waitTime + "s elapsed)");
                    }
                } else {
                    // Unknown status
                    if (waitTime % 10 === 0) {
                        addDebug("Unknown status (" + itemStatus + "), still waiting... (" + waitTime + "s elapsed)");
                    }
                }
                
                // Wait a bit before checking again
                $.sleep(checkInterval * 1000);
                waitTime += checkInterval;
            }
            
            if (waitTime >= maxWaitTime) {
                result.error = "Render timeout after " + maxWaitTime + " seconds";
                addDebug("❌ Render timeout");
                addDebug("Final queue status: " + renderQueue.status);
                addDebug("Final item status: " + renderQueueItem.status);
                return simpleStringify(result);
            }
            
        } catch (renderError) {
            result.error = "Render execution failed: " + renderError.toString();
            addDebug("ERROR: Render execution failed: " + renderError.toString());
            return simpleStringify(result);
        }
        
        // Check if files were actually created
        if (!renderComplete) {
            addDebug("❌ Render did not complete successfully");
            return simpleStringify(result);
        }
        
        addDebug("=== COMPREHENSIVE FILE VERIFICATION ===");
        addDebug("Checking temp folder: " + tempFolderPath);
        
        // Verify temp folder exists and is accessible
        try {
            if (!tempFolder.exists) {
                addDebug("❌ Temp folder does not exist: " + tempFolderPath);
                result.error = "Temp folder was not created or was deleted";
                return simpleStringify(result);
            }
            addDebug("✅ Temp folder exists");
        } catch (folderCheckError) {
            addDebug("❌ Error checking temp folder: " + folderCheckError.toString());
            result.error = "Could not access temp folder: " + folderCheckError.toString();
            return simpleStringify(result);
        }
        
        // Check for generated files with comprehensive file type analysis
        var generatedFiles = [];
        try {
            // Get all files in the temp folder
            var allFiles = tempFolder.getFiles("*");
            
            addDebug("=== DETAILED FILE ANALYSIS ===");
            addDebug("Total files in temp folder: " + (allFiles ? allFiles.length : 0));
            
            if (!allFiles || allFiles.length === 0) {
                addDebug("❌ No files found in temp folder");
                addDebug("Possible causes:");
                addDebug("  1. Template configuration issue");
                addDebug("  2. Output path configuration problem");
                addDebug("  3. Render failed silently");
                addDebug("  4. Files written to different location");
                
                // Check if render queue item has any output path information
                try {
                    var outputModule = renderQueueItem.outputModules[1];
                    if (outputModule && outputModule.file) {
                        addDebug("Expected output path: " + outputModule.file.fsName);
                        
                        // Check if the expected output file exists
                        var expectedFile = new File(outputModule.file.fsName);
                        if (expectedFile.exists) {
                            addDebug("✅ Found expected output file: " + expectedFile.fsName);
                        } else {
                            addDebug("❌ Expected output file does not exist: " + expectedFile.fsName);
                        }
                    }
                } catch (outputCheckError) {
                    addDebug("Could not check output module path: " + outputCheckError.toString());
                }
                
                result.error = "No files were generated in temp folder. Check render queue configuration and output template.";
                return simpleStringify(result);
            }
            
            // Analyze all files found
            addDebug("Files found in temp folder:");
            var imageExtensions = [".png", ".tiff", ".tif", ".psd", ".jpg", ".jpeg"];
            var imageFiles = [];
            var otherFiles = [];
            
            for (var f = 0; f < allFiles.length; f++) {
                var file = allFiles[f];
                var fileName = file.name;
                var fileExt = "";
                
                if (fileName.indexOf('.') !== -1) {
                    fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
                }
                
                addDebug("  - " + fileName + " (ext: " + fileExt + ", size: " + file.length + " bytes)");
                
                // Check if this is an image file
                var isImage = false;
                for (var ext = 0; ext < imageExtensions.length; ext++) {
                    if (fileExt === imageExtensions[ext]) {
                        isImage = true;
                        break;
                    }
                }
                
                if (isImage) {
                    imageFiles.push(fileName);
                } else {
                    otherFiles.push(fileName);
                }
            }
            
            addDebug("=== FILE CATEGORIZATION ===");
            addDebug("Image files found: " + imageFiles.length);
            addDebug("Other files found: " + otherFiles.length);
            
            if (imageFiles.length > 0) {
                addDebug("Image files:");
                for (var img = 0; img < imageFiles.length; img++) {
                    addDebug("  • " + imageFiles[img]);
                }
                generatedFiles = imageFiles;
                addDebug("✅ Found " + generatedFiles.length + " image files for sprite sheet");
            } else {
                addDebug("❌ No image files found");
                if (otherFiles.length > 0) {
                    addDebug("Non-image files found:");
                    for (var other = 0; other < otherFiles.length; other++) {
                        addDebug("  • " + otherFiles[other]);
                    }
                    result.error = "Render completed but generated non-image files. Check output template configuration.";
                } else {
                    result.error = "No image files were generated. Check render queue configuration.";
                }
                return simpleStringify(result);
            }
            
        } catch (fileCheckError) {
            result.error = "Error checking generated files: " + fileCheckError.toString();
            addDebug("ERROR during file verification: " + fileCheckError.toString());
            return simpleStringify(result);
        }
        
        // Clean up render queue
        try {
            renderQueueItem.remove();
            addDebug("✅ Cleaned up render queue item");
        } catch (cleanupError) {
            addDebug("Warning: Could not clean up render queue: " + cleanupError.toString());
        }
        
        addDebug("Completed Render Queue export. Successfully exported " + generatedFiles.length + " frames");
        
        // Return success
        result.tempFolder = tempFolderPath;
        result.frameCount = generatedFiles.length;
        result.compInfo = {
            name: comp.name,
            width: comp.width,
            height: comp.height,
            frameRate: comp.frameRate,
            duration: comp.duration,
            frameCount: frameCount
        };
        
        return simpleStringify(result);
        
    } catch (e) {
        result.error = "Export error: " + e.toString();
        addDebug("Exception caught: " + e.toString());
        return simpleStringify(result);
    }
}

// Clean up the render queue
function cleanupRenderQueue() {
    try {
        // Remove completed render queue items
        var rq = app.project.renderQueue;
        for (var i = rq.items.length; i > 0; i--) {
            var item = rq.items[i];
            if (item.status === RQItemStatus.DONE || item.status === RQItemStatus.FAILED) {
                item.remove();
            }
        }
        return simpleStringify({success: true});
    } catch (e) {
        return simpleStringify({error: "Failed to cleanup render queue: " + e.toString()});
    }
}
