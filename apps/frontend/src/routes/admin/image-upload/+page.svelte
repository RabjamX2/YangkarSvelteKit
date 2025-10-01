<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import AdminHeader from "../AdminHeader.svelte";
    import { createAuthFetch } from "$lib/utils/csrf";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import "./image-upload.css";
    import "./layout.css";
    import "./preview-styles.css";

    // Only import cropper CSS in the browser
    if (browser) {
        import("./cropper-essential.css");
    }

    // Environment variables
    const PUBLIC_BACKEND_URL = import.meta.env.VITE_PUBLIC_BACKEND_URL;

    // Stores
    const products = writable([]);
    const filteredProducts = writable([]);
    const selectedProduct = writable(null);
    const selectedVariant = writable(null);
    const variants = writable([]);
    const filteredVariants = writable([]);
    const loading = writable(false);
    const error = writable(null);
    const success = writable(null);
    const originalImage = writable(null);
    const croppedPreview = writable("/Placeholder4-5.png"); // Store for cropped image preview with placeholder
    const currentUser = writable(null);
    const estimatedSize = writable(null);

    // Search filters
    const productSearch = writable("");
    const variantSearch = writable("");

    // Image settings
    let fileInput;
    const aspectRatio = 4 / 5; // Fixed 4:5 aspect ratio
    let quality = 0.8; // Image compression quality (0-1)
    const maxWidth = 1000; // Maximum width for the uploaded image
    let Cropper;

    // Initialize data and Cropper library
    onMount(async () => {
        if (!browser) {
            return; // Don't try to run browser-dependent code on the server
        }

        try {
            // Check authentication
            const fetchAuth = createAuthFetch($page);
            const response = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/me`);
            const userData = await response.json();

            if (userData && userData.user) {
                currentUser.set(userData.user);
            } else {
                error.set("Please log in to upload images");
            }
        } catch (authErr) {
            error.set("Authentication error. Please try logging in again.");
        }

        // Load products data
        await loadProducts();

        // Load Cropper.js
        try {
            const CropperModule = await import("cropperjs");
            Cropper = CropperModule.default;
        } catch (err) {
            console.error("Failed to load Cropper.js:", err);
            error.set("Failed to load image cropping library. Please refresh the page.");
        }
    });

    // API Functions
    async function loadProducts() {
        loading.set(true);
        error.set(null);

        try {
            const fetchAuth = createAuthFetch($page);
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/products-with-variants?all=true`);

            if (!res.ok) {
                throw new Error(`Error fetching products: ${res.statusText}`);
            }

            const data = await res.json();
            const productsData = data.data || data;
            products.set(productsData);
            filteredProducts.set(productsData);
        } catch (err) {
            error.set(`Failed to load products: ${err.message}`);
        } finally {
            loading.set(false);
        }
    }

    // Filter Functions
    function filterProducts(term) {
        if (!term || term.trim() === "") {
            filteredProducts.set($products);
            return;
        }

        const searchTerm = term.toLowerCase().trim();
        const filtered = $products.filter((product) => {
            const displayName = product.displayName?.toLowerCase() || "";
            const style = product.style?.toLowerCase() || "";
            const skuBase = product.skuBase?.toLowerCase() || "";

            return displayName.includes(searchTerm) || style.includes(searchTerm) || skuBase.includes(searchTerm);
        });

        filteredProducts.set(filtered);
    }

    // Filter variants based on search term
    function filterVariants(term) {
        if (!term || term.trim() === "") {
            filteredVariants.set($variants);
            return;
        }

        const searchTerm = term.toLowerCase().trim();
        const filtered = $variants.filter((variant) => {
            const color = variant.color?.toLowerCase() || "";
            const size = variant.size?.toLowerCase() || "";
            const sku = variant.sku?.toLowerCase() || "";

            return color.includes(searchTerm) || size.includes(searchTerm) || sku.includes(searchTerm);
        });

        filteredVariants.set(filtered);
    }

    // Handle product search input
    function handleProductSearch(event) {
        const term = event.target.value;
        productSearch.set(term);
        filterProducts(term);
    }

    // Handle variant search input
    function handleVariantSearch(event) {
        const term = event.target.value;
        variantSearch.set(term);
        filterVariants(term);
    }

    // When a product is selected, update the variants list
    function handleProductChange(event) {
        const productId = parseInt(event.target.value);
        if (productId) {
            const product = $products.find((p) => p.id === productId);
            selectedProduct.set(product);
            const productVariants = product?.variants || [];
            variants.set(productVariants);
            filteredVariants.set(productVariants);
            selectedVariant.set(null);
            // Reset variant search when product changes
            variantSearch.set("");
        } else {
            selectedProduct.set(null);
            variants.set([]);
            filteredVariants.set([]);
            selectedVariant.set(null);
        }
    }

    // When a variant is selected
    function handleVariantChange(event) {
        const variantId = parseInt(event.target.value);
        if (variantId) {
            const variant = $variants.find((v) => v.id === variantId);
            selectedVariant.set(variant);
        } else {
            selectedVariant.set(null);
        }
    }

    // Helper function to get the normalized image boundaries
    function getImageBoundaries(imageRect, canvasRect) {
        return {
            left: imageRect.left - canvasRect.left,
            top: imageRect.top - canvasRect.top,
            right: imageRect.left - canvasRect.left + imageRect.width,
            bottom: imageRect.top - canvasRect.top + imageRect.height,
            width: imageRect.width,
            height: imageRect.height,
        };
    }

    // Get the previous selection state for comparing movement
    let prevSelectionState = null;

    // Check if selection is within image boundaries and return detailed info about violations and space
    function checkSelectionBoundaries(selection, imageBoundaries) {
        const selectionRight = selection.x + selection.width;
        const selectionBottom = selection.y + selection.height;

        // Calculate how far the selection extends beyond each boundary (negative = inside bounds)
        const overflow = {
            left: imageBoundaries.left - selection.x,
            top: imageBoundaries.top - selection.y,
            right: selectionRight - imageBoundaries.right,
            bottom: selectionBottom - imageBoundaries.bottom,
        };

        // Calculate available space on each side (positive = room to expand)
        const availableSpace = {
            left: selection.x - imageBoundaries.left,
            top: selection.y - imageBoundaries.top,
            right: imageBoundaries.right - selectionRight,
            bottom: imageBoundaries.bottom - selectionBottom,
        };

        // Boolean indicators for violations
        const violations = {
            left: overflow.left > 0,
            top: overflow.top > 0,
            right: overflow.right > 0,
            bottom: overflow.bottom > 0,
        };

        // Is the selection completely within bounds?
        const isWithinBounds = !violations.left && !violations.top && !violations.right && !violations.bottom;

        return {
            isWithinBounds,
            violations,
            overflow, // How far outside the bounds (positive = violation)
            availableSpace, // How much space available within bounds (positive = space available)
        };
    }

    // Adjust selection to keep it within boundaries but allow partial movement
    function adjustSelectionToFitBounds(newSelection, oldSelection, imageBoundaries) {
        // Distance in pixels that triggers snapping to edges
        const snapThreshold = 10;

        const adjusted = { ...newSelection };
        const selectionRight = newSelection.x + newSelection.width;
        const selectionBottom = newSelection.y + newSelection.height;

        // Get detailed boundary information
        const boundaryInfo = checkSelectionBoundaries(newSelection, imageBoundaries);

        // Check for snapping to left edge
        if (Math.abs(newSelection.x - imageBoundaries.left) < snapThreshold) {
            adjusted.x = imageBoundaries.left;
            // If we're moving (not resizing), maintain the width
            if (newSelection.width === oldSelection.width) {
                adjusted.width = newSelection.width;
            }
        }
        // If moving left past boundary, keep x at boundary
        else if (boundaryInfo.violations.left) {
            const diff = boundaryInfo.overflow.left;
            adjusted.x = imageBoundaries.left;
            // Don't adjust width for move operations (width should stay the same)
            if (newSelection.width !== oldSelection.width) {
                adjusted.width = Math.max(10, newSelection.width - diff);
            }
        }

        // Check for snapping to right edge
        if (Math.abs(selectionRight - imageBoundaries.right) < snapThreshold) {
            // If resizing from right edge
            if (newSelection.width !== oldSelection.width && newSelection.x === oldSelection.x) {
                adjusted.width = imageBoundaries.right - adjusted.x;
            }
            // If moving the entire selection
            else if (newSelection.width === oldSelection.width) {
                adjusted.x = imageBoundaries.right - newSelection.width;
            }
        }
        // If moving right past boundary, adjust x or width
        else if (boundaryInfo.violations.right) {
            // Don't adjust x for move operations (just constrain)
            if (newSelection.width !== oldSelection.width) {
                // If resizing, adjust width
                adjusted.width = imageBoundaries.right - adjusted.x;
            } else {
                // If moving, adjust position to keep within bounds
                adjusted.x = imageBoundaries.right - newSelection.width;
            }
        }

        // Check for snapping to top edge
        if (Math.abs(newSelection.y - imageBoundaries.top) < snapThreshold) {
            adjusted.y = imageBoundaries.top;
            // If we're moving (not resizing), maintain the height
            if (newSelection.height === oldSelection.height) {
                adjusted.height = newSelection.height;
            }
        }
        // If moving up past boundary, keep y at boundary
        else if (boundaryInfo.violations.top) {
            const diff = boundaryInfo.overflow.top;
            adjusted.y = imageBoundaries.top;
            // Don't adjust height for move operations (height should stay the same)
            if (newSelection.height !== oldSelection.height) {
                adjusted.height = Math.max(10, newSelection.height - diff);
            }
        }

        // Check for snapping to bottom edge
        if (Math.abs(selectionBottom - imageBoundaries.bottom) < snapThreshold) {
            // If resizing from bottom edge
            if (newSelection.height !== oldSelection.height && newSelection.y === oldSelection.y) {
                adjusted.height = imageBoundaries.bottom - adjusted.y;
            }
            // If moving the entire selection
            else if (newSelection.height === oldSelection.height) {
                adjusted.y = imageBoundaries.bottom - newSelection.height;
            }
        }
        // If moving down past boundary, adjust y or height
        else if (boundaryInfo.violations.bottom) {
            // Don't adjust y for move operations (just constrain)
            if (newSelection.height !== oldSelection.height) {
                // If resizing, adjust height
                adjusted.height = imageBoundaries.bottom - adjusted.y;
            } else {
                // If moving, adjust position to keep within bounds
                adjusted.y = imageBoundaries.bottom - newSelection.height;
            }
        }

        return adjusted;
    }

    // Setup the optimal initial selection size
    function setupOptimalInitialSelection(canvas, image, selection) {
        // Get the bounding boxes
        const canvasRect = canvas.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();

        // Calculate image bounds relative to canvas
        const imageBounds = getImageBoundaries(imageRect, canvasRect);

        // Calculate the maximum possible selection size while maintaining aspect ratio
        // and staying within image bounds
        let selectionWidth, selectionHeight;

        // For our aspect ratio (4:5 = 0.8), we need to determine whether the width or height
        // is the constraining dimension for the maximum possible selection

        // Case 1: Width-constrained (using full width)
        const maxWidthApproach = {
            width: imageBounds.width,
            height: imageBounds.width / aspectRatio,
        };

        // Case 2: Height-constrained (using full height)
        const maxHeightApproach = {
            height: imageBounds.height,
            width: imageBounds.height * aspectRatio,
        };

        console.log("Width approach:", maxWidthApproach);
        console.log("Height approach:", maxHeightApproach);

        // Choose the approach that fits entirely within the image
        // (the smaller of the two options)
        if (maxWidthApproach.height <= imageBounds.height) {
            // Width approach fits within height, use it
            selectionWidth = maxWidthApproach.width;
            selectionHeight = maxWidthApproach.height;
        } else {
            // Width approach would exceed height, use height approach
            selectionWidth = maxHeightApproach.width;
            selectionHeight = maxHeightApproach.height;
        }

        // Add a tiny margin (0.5px) to prevent edge issues
        selectionWidth = Math.floor(selectionWidth - 0.5);
        selectionHeight = Math.floor(selectionHeight - 0.5);

        // Calculate centered position
        const centerX = imageBounds.left + (imageBounds.width - selectionWidth) / 2;
        const centerY = imageBounds.top + (imageBounds.height - selectionHeight) / 2;

        // Set the selection attributes
        selection.x = centerX;
        selection.y = centerY;
        selection.width = selectionWidth;
        selection.height = selectionHeight;

        // Also update DOM attributes for better synchronization
        selection.setAttribute("x", centerX);
        selection.setAttribute("y", centerY);
        selection.setAttribute("width", selectionWidth);
        selection.setAttribute("height", selectionHeight);

        // Log the dimensions for debugging
        console.log("Image bounds:", {
            width: imageBounds.width,
            height: imageBounds.height,
        });
        console.log("Optimal selection:", {
            width: selectionWidth,
            height: selectionHeight,
            ratio: selectionWidth / selectionHeight,
        });

        // Update our tracking state
        prevSelectionState = {
            x: centerX,
            y: centerY,
            width: selectionWidth,
            height: selectionHeight,
        };

        // Trigger an initial preview update
        setTimeout(() => updateCroppedPreview(), 150);
    }

    // Setup event listeners for constrained selection
    function setupConstrainedSelection() {
        // Start with a shorter timeout to first check if elements are available
        setTimeout(() => {
            let canvas = document.querySelector("cropper-canvas");
            let image = document.querySelector("cropper-image");
            let selection = document.querySelector("cropper-selection");

            // If elements aren't ready, wait a bit longer
            if (!canvas || !image || !selection) {
                console.log("Elements not ready yet, waiting longer...");
                setTimeout(() => {
                    canvas = document.querySelector("cropper-canvas");
                    image = document.querySelector("cropper-image");
                    selection = document.querySelector("cropper-selection");

                    if (!canvas || !image || !selection) {
                        console.error("Could not find cropper elements after extended wait");
                        return;
                    }

                    // Make sure the image is fully loaded before calculating dimensions
                    if (image.complete) {
                        setupOptimalInitialSelection(canvas, image, selection);
                    } else {
                        image.onload = () => setupOptimalInitialSelection(canvas, image, selection);
                    }
                }, 300);
                return;
            }

            // Set up the optimal initial selection size
            setupOptimalInitialSelection(canvas, image, selection); // Store initial selection state
            const initialRect = selection.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            prevSelectionState = {
                x: initialRect.left - canvasRect.left,
                y: initialRect.top - canvasRect.top,
                width: initialRect.width,
                height: initialRect.height,
            };

            // Store initial image transform matrix to prevent scaling
            const computedStyle = window.getComputedStyle(image);
            const initialTransform = computedStyle.transform || computedStyle.webkitTransform || "none";
            let initialMatrix;

            if (initialTransform !== "none") {
                // Parse the matrix values if there's an initial transform
                const transformValues = initialTransform.match(/matrix\(([^)]+)\)/);
                if (transformValues && transformValues[1]) {
                    initialMatrix = transformValues[1].split(",").map(Number);
                }
            }

            // If no initial transform is found, use identity matrix
            if (!initialMatrix) {
                initialMatrix = [1, 0, 0, 1, 0, 0]; // Identity matrix
            }

            // Track whether we're in the middle of applying adjustments
            // This prevents event cascading and race conditions
            let isAdjusting = false;

            // Debounce timer for preview updates
            let previewUpdateTimer;

            // Handle touch events for pinch-to-zoom on mobile
            let initialTouches = [];
            let lastTouchDistance = 0;
            let isTouchZooming = false;

            // Helper function to apply zoom with smart boundary handling
            function applyZoom(zoomDirection, customZoomFactor) {
                const canvasRect = canvas.getBoundingClientRect();
                const imageRect = image.getBoundingClientRect();
                const imageBoundaries = getImageBoundaries(imageRect, canvasRect);

                // Use provided zoom factor or calculate based on direction
                const zoomFactor = customZoomFactor || (zoomDirection > 0 ? 1.05 : 0.95);

                // Get current selection dimensions
                const currentWidth = selection.width;
                const currentHeight = selection.height;
                const currentX = selection.x;
                const currentY = selection.y;

                // Calculate new dimensions
                const newWidth = currentWidth * zoomFactor;
                const newHeight = currentHeight * zoomFactor;

                // Calculate new position (centered on current position)
                const deltaWidth = (newWidth - currentWidth) / 2;
                const deltaHeight = (newHeight - currentHeight) / 2;
                const newX = currentX - deltaWidth;
                const newY = currentY - deltaHeight;

                // Create proposed new selection
                const proposedSelection = {
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                };

                // Enhanced boundary checking with space analysis
                const boundaryCheck = checkSelectionBoundaries(proposedSelection, imageBoundaries);

                let finalSelection;

                // For zooming in (making selection smaller)
                if (zoomDirection === -1) {
                    // Check minimum size to prevent too small selections
                    if (newWidth < 40 || newHeight < 50) {
                        console.log("Selection too small, preventing zoom in");
                        return;
                    }
                    finalSelection = proposedSelection;
                }
                // For zooming out (making selection larger)
                else if (zoomDirection === 1) {
                    if (!boundaryCheck.isWithinBounds) {
                        // If we can't zoom out normally, try smart zooming with shifts
                        const spaceInfo = boundaryCheck.availableSpace;

                        // Calculate directional shifts based on available space
                        let shiftX = 0;
                        let shiftY = 0;

                        // If violating right boundary but have space on left, shift left
                        if (boundaryCheck.violations.right && spaceInfo.left > deltaWidth) {
                            shiftX = -Math.min(spaceInfo.left, deltaWidth);
                        }
                        // If violating left boundary but have space on right, shift right
                        else if (boundaryCheck.violations.left && spaceInfo.right > deltaWidth) {
                            shiftX = Math.min(spaceInfo.right, deltaWidth);
                        }

                        // If violating bottom boundary but have space on top, shift up
                        if (boundaryCheck.violations.bottom && spaceInfo.top > deltaHeight) {
                            shiftY = -Math.min(spaceInfo.top, deltaHeight);
                        }
                        // If violating top boundary but have space on bottom, shift down
                        else if (boundaryCheck.violations.top && spaceInfo.bottom > deltaHeight) {
                            shiftY = Math.min(spaceInfo.bottom, deltaHeight);
                        }

                        // Apply shifts to create final selection
                        finalSelection = {
                            x: proposedSelection.x + shiftX,
                            y: proposedSelection.y + shiftY,
                            width: proposedSelection.width,
                            height: proposedSelection.height,
                        };

                        // Verify the final selection is within bounds or as close as possible
                        const finalCheck = checkSelectionBoundaries(finalSelection, imageBoundaries);
                        if (!finalCheck.isWithinBounds) {
                            console.log("Smart zoom couldn't fit selection within bounds");

                            // Calculate how much more we need to grow beyond bounds
                            const overflowTotal =
                                (finalCheck.overflow.left > 0 ? finalCheck.overflow.left : 0) +
                                (finalCheck.overflow.right > 0 ? finalCheck.overflow.right : 0) +
                                (finalCheck.overflow.top > 0 ? finalCheck.overflow.top : 0) +
                                (finalCheck.overflow.bottom > 0 ? finalCheck.overflow.bottom : 0);

                            // Check if current selection is already outside bounds
                            const currentSelectionCheck = checkSelectionBoundaries(
                                { x: currentX, y: currentY, width: currentWidth, height: currentHeight },
                                imageBoundaries
                            );

                            // Calculate current overflow
                            const currentOverflowTotal =
                                (currentSelectionCheck.overflow.left > 0 ? currentSelectionCheck.overflow.left : 0) +
                                (currentSelectionCheck.overflow.right > 0 ? currentSelectionCheck.overflow.right : 0) +
                                (currentSelectionCheck.overflow.top > 0 ? currentSelectionCheck.overflow.top : 0) +
                                (currentSelectionCheck.overflow.bottom > 0 ? currentSelectionCheck.overflow.bottom : 0);

                            // Only prevent if the new selection makes things worse or doesn't improve significantly
                            if (overflowTotal > 20) {
                                // If overflow is too significant and doesn't improve situation, prevent zooming
                                console.log("Zoom prevented - selection would exceed image boundaries too much");
                                return;
                            }

                            // For minor overflow, use standard boundary adjustment as a fallback
                            finalSelection = adjustSelectionToFitBounds(
                                proposedSelection,
                                { x: currentX, y: currentY, width: currentWidth, height: currentHeight },
                                imageBoundaries
                            );
                        }
                    } else {
                        // Selection fits within bounds, no adjustment needed
                        finalSelection = proposedSelection;
                    }
                }

                // Apply the new selection values with verification
                if (finalSelection) {
                    // Safety check for NaN or invalid values
                    if (
                        isNaN(finalSelection.x) ||
                        isNaN(finalSelection.y) ||
                        isNaN(finalSelection.width) ||
                        isNaN(finalSelection.height) ||
                        finalSelection.width <= 0 ||
                        finalSelection.height <= 0
                    ) {
                        console.error("Invalid selection values:", finalSelection);
                        return;
                    }

                    // Final boundary check before applying - make sure we don't allow selections outside the image
                    const lastCheck = checkSelectionBoundaries(finalSelection, imageBoundaries);
                    if (!lastCheck.isWithinBounds) {
                        // Calculate how much it's outside boundaries
                        const totalOverflow =
                            (lastCheck.overflow.left > 0 ? lastCheck.overflow.left : 0) +
                            (lastCheck.overflow.right > 0 ? lastCheck.overflow.right : 0) +
                            (lastCheck.overflow.top > 0 ? lastCheck.overflow.top : 0) +
                            (lastCheck.overflow.bottom > 0 ? lastCheck.overflow.bottom : 0);

                        // Check current selection to see if it's already outside bounds
                        const currentCheck = checkSelectionBoundaries(
                            { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
                            imageBoundaries
                        );

                        const currentOverflow =
                            (currentCheck.overflow.left > 0 ? currentCheck.overflow.left : 0) +
                            (currentCheck.overflow.right > 0 ? currentCheck.overflow.right : 0) +
                            (currentCheck.overflow.top > 0 ? currentCheck.overflow.top : 0) +
                            (currentCheck.overflow.bottom > 0 ? currentCheck.overflow.bottom : 0);

                        if (totalOverflow) {
                            console.log("Prevented zoom that would exceed image boundaries");

                            return;
                        }
                    }

                    selection.x = finalSelection.x;
                    selection.y = finalSelection.y;
                    selection.width = finalSelection.width;
                    selection.height = finalSelection.height;

                    // Also set attributes to ensure DOM is updated
                    selection.setAttribute("x", finalSelection.x);
                    selection.setAttribute("y", finalSelection.y);
                    selection.setAttribute("width", finalSelection.width);
                    selection.setAttribute("height", finalSelection.height);

                    // Update previous state
                    prevSelectionState = {
                        x: finalSelection.x,
                        y: finalSelection.y,
                        width: finalSelection.width,
                        height: finalSelection.height,
                    };

                    // Update the preview
                    clearTimeout(previewUpdateTimer);
                    previewUpdateTimer = setTimeout(() => updateCroppedPreview(), 150);

                    return finalSelection;
                }

                return null;
            }

            // Add touch event handlers to selection for pinch-to-zoom
            selection.addEventListener(
                "touchstart",
                (event) => {
                    if (event.touches.length === 2) {
                        // Prevent default to avoid browser zooming
                        event.preventDefault();

                        // Store initial touch points
                        initialTouches = Array.from(event.touches).map((touch) => ({
                            identifier: touch.identifier,
                            x: touch.clientX,
                            y: touch.clientY,
                        }));

                        // Calculate initial distance between touch points
                        lastTouchDistance = Math.hypot(
                            initialTouches[1].x - initialTouches[0].x,
                            initialTouches[1].y - initialTouches[0].y
                        );

                        isTouchZooming = true;
                    }
                },
                { passive: false }
            );

            selection.addEventListener(
                "touchmove",
                (event) => {
                    if (isTouchZooming && event.touches.length === 2) {
                        // Prevent default to avoid browser behaviors
                        event.preventDefault();

                        // Calculate current touch distance
                        const touch1 = event.touches[0];
                        const touch2 = event.touches[1];
                        const currentDistance = Math.hypot(
                            touch2.clientX - touch1.clientX,
                            touch2.clientY - touch1.clientY
                        );

                        // Calculate scale factor based on the change in distance
                        const scaleFactor = currentDistance / lastTouchDistance;

                        // Don't apply tiny changes
                        if (Math.abs(scaleFactor - 1) < 0.02) return;

                        // Determine zoom direction (in/out)
                        const zoomDirection = scaleFactor < 1 ? -1 : 1;

                        // Apply zooming using our helper function
                        applyZoom(zoomDirection, scaleFactor);

                        // Update last distance for next move event
                        lastTouchDistance = currentDistance;
                    }
                },
                { passive: false }
            );

            selection.addEventListener("touchend", (event) => {
                if (isTouchZooming && event.touches.length < 2) {
                    isTouchZooming = false;
                    initialTouches = [];
                }
            });

            // Handle boundary adjustments in a more robust way
            function handleSelectionChange(event) {
                // Avoid cascading events during adjustment
                if (isAdjusting) return;

                const canvasRect = canvas.getBoundingClientRect();
                const imageRect = image.getBoundingClientRect();
                const imageBoundaries = getImageBoundaries(imageRect, canvasRect);

                // Get the new selection state
                const newSelection = event.detail;

                // Check if selection is within boundaries
                const boundaryCheck = checkSelectionBoundaries(newSelection, imageBoundaries);

                if (!boundaryCheck.isWithinBounds) {
                    try {
                        // Mark that we're adjusting to prevent cascading events
                        isAdjusting = true;

                        // Prevent the default behavior
                        event.preventDefault();

                        // Calculate adjusted selection that respects boundaries
                        const adjustedSelection = adjustSelectionToFitBounds(
                            newSelection,
                            prevSelectionState || newSelection,
                            imageBoundaries
                        );

                        // Apply the adjusted selection (use the Cropper API to set it)
                        selection.x = adjustedSelection.x;
                        selection.y = adjustedSelection.y;
                        selection.width = adjustedSelection.width;
                        selection.height = adjustedSelection.height;

                        // Force synchronization of DOM with the new coordinates
                        selection.setAttribute("x", adjustedSelection.x);
                        selection.setAttribute("y", adjustedSelection.y);
                        selection.setAttribute("width", adjustedSelection.width);
                        selection.setAttribute("height", adjustedSelection.height);

                        // Update previous state
                        prevSelectionState = { ...adjustedSelection };
                    } finally {
                        // Clear the flag after a short delay to ensure DOM updates complete
                        setTimeout(() => {
                            isAdjusting = false;
                        }, 10);
                    }
                } else {
                    // If within bounds, simply update previous state
                    prevSelectionState = {
                        x: selection.x,
                        y: selection.y,
                        width: selection.width,
                        height: selection.height,
                    };
                }

                // Debounce the preview update to avoid performance issues during rapid movements
                clearTimeout(previewUpdateTimer);
                previewUpdateTimer = setTimeout(() => updateCroppedPreview(), 150);
            }

            // Remove any existing event listeners to prevent duplicates
            selection.removeEventListener("change", handleSelectionChange);

            // Add the optimized event handler
            selection.addEventListener("change", handleSelectionChange);

            // Track if we're handling a transform to prevent cascading
            let isHandlingTransform = false;

            // Listen for image load to set optimal selection
            if (image.complete) {
                console.log("Image already loaded, optimizing selection immediately");
                setupOptimalInitialSelection(canvas, image, selection);
            } else {
                console.log("Adding onload handler for image");
                image.addEventListener("load", () => {
                    console.log("Image loaded, optimizing selection");
                    setupOptimalInitialSelection(canvas, image, selection);
                });
            }

            // Listen for image transformation
            image.addEventListener("transform", (event) => {
                // Avoid cascading events
                if (isHandlingTransform) return;

                try {
                    isHandlingTransform = true;

                    // Ensure event.detail exists and has matrix property
                    if (!event.detail || !Array.isArray(event.detail.matrix)) {
                        event.preventDefault();
                        return;
                    }

                    const transformMatrix = event.detail.matrix;

                    // Determine if this is a scaling operation
                    // In a transform matrix [a, b, c, d, e, f], scaling is determined by a and d
                    // If they're not equal to the initial values, scaling is being attempted
                    if (transformMatrix[0] !== initialMatrix[0] || transformMatrix[3] !== initialMatrix[3]) {
                        // Prevent scaling by reverting to initial scale factors
                        event.preventDefault();
                        return;
                    }

                    const canvasRect = canvas.getBoundingClientRect();

                    // Use a try-finally block to ensure proper cleanup
                    try {
                        // Create a clone to calculate new boundaries without applying transform
                        const imageClone = image.cloneNode();
                        imageClone.style.transform = `matrix(${event.detail.matrix.join(", ")})`;
                        imageClone.style.opacity = "0";
                        imageClone.style.pointerEvents = "none"; // Prevent interaction with the clone

                        // Add to DOM temporarily to get measurements
                        canvas.appendChild(imageClone);

                        // Force a reflow to ensure getBoundingClientRect works properly
                        void imageClone.offsetWidth;

                        const imageRect = imageClone.getBoundingClientRect();

                        // Get the image boundaries
                        const imageBoundaries = getImageBoundaries(imageRect, canvasRect);

                        // Get current selection more reliably
                        const selectionRect = selection.getBoundingClientRect();
                        const currentSelection = {
                            x: selectionRect.left - canvasRect.left,
                            y: selectionRect.top - canvasRect.top,
                            width: selectionRect.width,
                            height: selectionRect.height,
                        };

                        // Check if selection will be outside image boundaries
                        const boundaryCheck = checkSelectionBoundaries(currentSelection, imageBoundaries);

                        // If the transformation would move selection outside, prevent it
                        if (!boundaryCheck.isWithinBounds) {
                            event.preventDefault();
                        } else {
                            // If transform is allowed, update the previous selection state
                            // after a short delay to ensure everything is settled
                            setTimeout(() => {
                                // Get updated position after transform
                                const newSelectionRect = selection.getBoundingClientRect();
                                const newCanvasRect = canvas.getBoundingClientRect();

                                prevSelectionState = {
                                    x: newSelectionRect.left - newCanvasRect.left,
                                    y: newSelectionRect.top - newCanvasRect.top,
                                    width: newSelectionRect.width,
                                    height: newSelectionRect.height,
                                };

                                // Update the preview
                                updateCroppedPreview();
                            }, 100);
                        }
                    } finally {
                        // Always remove the clone to avoid memory leaks
                        const clones = canvas.querySelectorAll('cropper-image:not([alt="Image"])');
                        clones.forEach((clone) => {
                            try {
                                canvas.removeChild(clone);
                            } catch (e) {}
                        });
                    }
                } finally {
                    // Always reset the handling flag
                    setTimeout(() => {
                        isHandlingTransform = false;
                    }, 50);
                }
            }); // Prevent zooming on the image (but allow other mouse wheel actions)
            canvas.addEventListener(
                "wheel",
                (event) => {
                    // First check if event.target exists and is a valid DOM element
                    if (!event.target || typeof event.target !== "object") {
                        event.preventDefault();
                        return;
                    }

                    // Always prevent default to stop browser zoom
                    event.preventDefault();

                    // Check if this is the image or canvas - no action needed for these
                    if (event.target === image || event.target === canvas) {
                        return;
                    }

                    // Check if wheel event is on selection or its children
                    let isOnSelection = false;
                    if (event.target === selection) {
                        isOnSelection = true;
                    } else if (typeof event.target.closest === "function") {
                        isOnSelection = !!event.target.closest("cropper-selection");
                    } else if (selection.contains && selection.contains(event.target)) {
                        isOnSelection = true;
                    }

                    // Only handle wheel events on the selection
                    if (!isOnSelection) {
                        return;
                    }

                    // Handle controlled zooming with boundary constraints
                    const canvasRect = canvas.getBoundingClientRect();
                    const imageRect = image.getBoundingClientRect();
                    const imageBoundaries = getImageBoundaries(imageRect, canvasRect);

                    // Determine zoom direction based on standard zoom mental model:
                    // When scrolling up (negative deltaY), zoom IN on the image (smaller selection)
                    // When scrolling down (positive deltaY), zoom OUT on the image (larger selection)
                    const zoomDirection = event.deltaY > 0 ? 1 : -1;

                    // Apply zooming using our helper function
                    applyZoom(zoomDirection);
                },
                { passive: false }
            );

            // Prevent pinch-to-zoom on touch devices
            canvas.addEventListener(
                "touchmove",
                (event) => {
                    // Check for multi-touch (pinch gesture)
                    if (event.touches && event.touches.length > 1) {
                        // Check if we have a valid target
                        if (!event.target) {
                            event.preventDefault();
                            return;
                        }

                        // Prevent default for pinch gestures on the image
                        if (
                            event.target === image ||
                            event.target === canvas ||
                            (typeof event.target.contains === "function" && image.contains(event.target))
                        ) {
                            event.preventDefault();
                        }
                    }
                },
                { passive: false }
            );
        }, 400); // Give time for components to initialize
    }

    function makeCanvasHTML(img) {
        return `
            <cropper-canvas background>
                <cropper-image src="${img}" scalable rotatable translatable initialCenterSize="contain" alt="Image"></cropper-image>
                <cropper-shade hidden></cropper-shade>
                <cropper-selection movable resizable aspect-ratio="${aspectRatio}" id="main-selection">
                    <cropper-grid role="grid" covered></cropper-grid>
                    <cropper-crosshair centered></cropper-crosshair>
                    <cropper-handle action="move" drag-mode="move"></cropper-handle>
                    <cropper-handle action="n-resize"></cropper-handle>
                    <cropper-handle action="e-resize"></cropper-handle>
                    <cropper-handle action="s-resize"></cropper-handle>
                    <cropper-handle action="w-resize"></cropper-handle>
                    <cropper-handle action="ne-resize"></cropper-handle>
                    <cropper-handle action="nw-resize"></cropper-handle>
                    <cropper-handle action="se-resize"></cropper-handle>
                    <cropper-handle action="sw-resize"></cropper-handle>
                </cropper-selection>
            </cropper-canvas>
        `;
    }

    // File and image handling
    function handleFileSelect(event) {
        if (!browser) return; // Don't run in SSR

        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.match("image.*")) {
            error.set("Please select an image file");
            return;
        }

        // Check file size (in MB)
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 10) {
            error.set(`Image file is too large (${fileSizeMB.toFixed(2)} MB). Please select an image under 10 MB.`);
            return;
        }

        // Check if Cropper library is loaded
        if (!Cropper) {
            error.set("Image cropping library is not loaded. Please refresh the page.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage.set(e.target.result);
            success.set(null);
            error.set(null);

            // Reset global state first
            prevSelectionState = null;

            // Set preview to placeholder initially when a new file is selected
            croppedPreview.set("/Placeholder4-5.png");

            // Initialize cropper with a slight delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    const container = document.querySelector(".cropper-container");
                    if (!container) {
                        throw new Error("Cropper container element is not ready");
                    }

                    // Clear any existing cropper elements and event listeners
                    container.innerHTML = "";

                    // Initialize cropper web components
                    container.innerHTML = makeCanvasHTML(e.target.result);

                    // Setup the constrained selection to keep selection within image bounds
                    // with a slightly longer delay for reliable initialization
                    setTimeout(() => {
                        setupConstrainedSelection();

                        // Calculate estimated size after setup is complete
                        setTimeout(async () => {
                            const size = await estimateFileSize();
                            estimatedSize.set(size);
                            // estimateFileSize already updates the preview
                        }, 300);
                    }, 100);
                } catch (err) {
                    error.set("Failed to initialize image cropper: " + err.message);
                }
            }, 200);
        };
        reader.readAsDataURL(file);
    }

    function resetCropper() {
        try {
            const container = document.querySelector(".cropper-container");
            if (container && $originalImage) {
                // Clear any existing event listeners by removing elements
                container.innerHTML = "";

                // Reset the global previous selection state
                prevSelectionState = null;

                // Reset preview to placeholder first
                croppedPreview.set("/Placeholder4-5.png");

                // Re-create the cropper elements
                container.innerHTML = makeCanvasHTML($originalImage);

                // Setup the constrained selection to keep selection within image bounds
                // with a slightly longer delay to ensure DOM is fully ready
                setTimeout(() => {
                    setupConstrainedSelection();

                    // Update estimated size and preview
                    setTimeout(async () => {
                        const size = await estimateFileSize();
                        estimatedSize.set(size);
                    }, 300);
                }, 100);
            }
        } catch (error) {
            console.error("Error during reset:", error);
        }
    }

    // Estimate output file size based on canvas dimensions and quality
    async function estimateFileSize() {
        if (!$originalImage) return null;

        try {
            const selection = document.querySelector("cropper-selection");
            if (!selection) return null;

            // Get canvas from selection
            const canvas = await selection.$toCanvas({
                maxWidth: maxWidth,
                maxHeight: maxWidth * (5 / 4),
                fillColor: "#fff",
                imageSmoothingEnabled: true,
                imageSmoothingQuality: "high",
            });

            // Update the preview with the current cropped image
            await updateCroppedPreview(canvas);

            // Estimate size based on dimensions and quality
            // This is a rough estimation - actual compression varies by image content
            const width = canvas.width;
            const height = canvas.height;
            const pixelCount = width * height;

            // JPEG compression ratio estimate based on quality setting
            // This is an approximate formula
            const compressionRatio = 0.1 + 0.9 * quality;

            // Estimate bytes (3 bytes per pixel at 100% quality, then apply compression)
            const estimatedBytes = pixelCount * 3 * compressionRatio;
            const estimatedMB = estimatedBytes / (1024 * 1024);

            return estimatedMB.toFixed(2);
        } catch (err) {
            console.error("Error estimating file size:", err);
            return null;
        }
    }

    // Update the cropped image preview
    async function updateCroppedPreview(canvas) {
        try {
            // Find elements if not passed directly
            if (!canvas) {
                canvas = document.querySelector("cropper-canvas");
                if (!canvas) {
                    console.error("Canvas not found for preview update");
                    return;
                }
            }

            // Get cropper selection and image
            const selection = canvas.querySelector("cropper-selection");
            const image = canvas.querySelector("cropper-image");
            if (!selection || !image) {
                console.error("Selection or image not found for preview update");
                return;
            }

            // Create a new canvas for the cropped image
            const croppedCanvas = document.createElement("canvas");

            // Set the output dimensions based on the selection aspect ratio
            const selectionWidth = selection.width;
            const selectionHeight = selection.height;

            // Calculate aspect ratio to ensure it's exactly 4:5
            const targetAspectRatio = 4 / 5; // width/height = 0.8

            // Use moderate size for preview (maintain exact 4:5 aspect ratio)
            const MAX_DIMENSION = 600;
            let outputWidth, outputHeight;

            // First determine width based on max dimension
            outputWidth = Math.min(selectionWidth, MAX_DIMENSION);
            // Calculate height to maintain exact 4:5 ratio
            outputHeight = outputWidth / targetAspectRatio;

            // Verify the aspect ratio is exactly 0.8
            const actualRatio = outputWidth / outputHeight;
            console.log("Preview aspect ratio:", actualRatio, "Target:", targetAspectRatio);

            croppedCanvas.width = outputWidth;
            croppedCanvas.height = outputHeight;

            // Draw the cropped portion
            const ctx = croppedCanvas.getContext("2d");

            // Get canvas from selection - use the proper $toCanvas method
            const croppedImageCanvas = await selection.$toCanvas({
                maxWidth: outputWidth,
                maxHeight: outputHeight,
                fillColor: "#fff",
                imageSmoothingEnabled: true,
                imageSmoothingQuality: "high",
            });

            // Convert canvas to dataURL with current quality
            const adaptiveQuality = canvas.width > 1000 ? Math.min(quality, 0.8) : quality;
            const previewUrl = croppedImageCanvas.toDataURL("image/jpeg", adaptiveQuality);

            // Only update if we have a valid image data URL
            if (previewUrl && previewUrl.startsWith("data:image/")) {
                croppedPreview.set(previewUrl);
            }
        } catch (err) {
            console.error("Error generating preview:", err);
        }
    }

    // Upload cropped image
    async function uploadImage() {
        if (!Cropper) {
            error.set("Image cropping library is not loaded. Please refresh the page.");
            return;
        }

        if (!$selectedVariant) {
            error.set("Please select a product variant");
            return;
        }

        if (!$originalImage) {
            error.set("Please select an image first");
            return;
        }

        loading.set(true);
        error.set(null);
        success.set(null);

        try {
            // Get the selection element
            const selection = document.querySelector("cropper-selection");
            if (!selection) {
                throw new Error("Cannot find the selection element. Please try again.");
            }

            // Get canvas from selection
            const canvas = await selection.$toCanvas({
                maxWidth: maxWidth,
                maxHeight: maxWidth * (5 / 4),
                fillColor: "#fff",
                imageSmoothingEnabled: true,
                imageSmoothingQuality: "high",
            });

            // Convert canvas to blob with optimized compression
            const blob = await new Promise((resolve, reject) => {
                // Use lower quality for larger images to control file size
                const adaptiveQuality = canvas.width > 1000 ? Math.min(quality, 0.8) : quality;

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Canvas toBlob returned null"));
                        }
                    },
                    "image/jpeg",
                    adaptiveQuality
                );
            });

            // Check final blob size
            const blobSizeMB = blob.size / (1024 * 1024);
            console.log(`Final image size: ${blobSizeMB.toFixed(2)} MB`);

            // Create form data with the blob
            const formData = new FormData();

            // If blob is too large, try to reduce quality further
            if (blobSizeMB > 3) {
                const reducedQuality = Math.max(0.5, quality - 0.3);
                const reducedBlob = await new Promise((resolve, reject) => {
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error("Canvas toBlob returned null"));
                            }
                        },
                        "image/jpeg",
                        reducedQuality
                    );
                });
                console.log(`Image was too large. Reduced quality to ${reducedQuality.toFixed(2)}`);
                console.log(`New size: ${(reducedBlob.size / (1024 * 1024)).toFixed(2)} MB`);

                // Use the reduced quality blob
                // Ensure the correct field name "image" is used for the file
                const file = new File([reducedBlob], "product-image.jpg", { type: "image/jpeg" });
                formData.append("image", file);
            } else {
                // Use the original blob
                // Ensure the correct field name "image" is used for the file
                const file = new File([blob], "product-image.jpg", { type: "image/jpeg" });
                formData.append("image", file);
            }

            // Upload to backend with CSRF protection
            // Create a custom fetch that doesn't set Content-Type for FormData
            const customFetchAuth = async (url, options) => {
                // Get authentication data from page
                const authStore = $page.data.auth;
                const token = authStore?.accessToken;

                // Create headers without Content-Type - browser will set it for FormData
                const headers = {};

                // Add authorization if available
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`;
                }

                // Add CSRF token if available
                if (authStore?.csrfToken) {
                    headers["X-CSRF-Token"] = authStore.csrfToken;
                }

                // Debug the formData
                console.log("FormData entries:");
                for (let pair of formData.entries()) {
                    console.log(
                        pair[0] +
                            ": " +
                            (pair[1] instanceof File ? `File: ${pair[1].name}, size: ${pair[1].size} bytes` : pair[1])
                    );
                }

                return fetch(url, {
                    ...options,
                    headers: {
                        ...headers,
                        ...options.headers,
                    },
                    credentials: "include",
                });
            };

            // Use our custom fetch that doesn't set Content-Type
            const res = await customFetchAuth(`${PUBLIC_BACKEND_URL}/api/upload-image`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                let errorDetails = `Status: ${res.status} ${res.statusText}`;
                try {
                    const errorResponse = await res.text();
                    console.error("Error response:", errorResponse);
                    try {
                        // Try to parse as JSON
                        const jsonError = JSON.parse(errorResponse);
                        if (jsonError.message) {
                            errorDetails += ` - ${jsonError.message}`;
                        } else {
                            errorDetails += ` - ${errorResponse}`;
                        }
                    } catch (jsonErr) {
                        // Not JSON, use as text
                        errorDetails += ` - ${errorResponse}`;
                    }
                } catch (e) {
                    errorDetails += " (No additional error details available)";
                    console.error("Error parsing error response:", e);
                }
                throw new Error(`Upload failed: ${errorDetails}`);
            }

            const uploadResult = await res.json();

            // Update product variant with new image URL
            const updateRes = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/variants/${$selectedVariant.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    imgUrl: uploadResult.location,
                }),
            });

            if (!updateRes.ok) {
                let errorDetails = `Status: ${updateRes.status} ${updateRes.statusText}`;
                throw new Error(`Failed to update variant: ${errorDetails}`);
            }

            // Update success message and local state
            success.set(
                `Image uploaded and assigned to ${$selectedProduct.displayName || $selectedProduct.style} - ${$selectedVariant.color || ""} ${$selectedVariant.size || ""}`
            );

            // Update local state to reflect the change
            selectedVariant.update((v) => ({
                ...v,
                imgUrl: uploadResult.location,
            }));

            // Clear the file input
            if (fileInput) {
                fileInput.value = "";
            }

            // Reset preview back to placeholder after successful upload
            setTimeout(() => {
                croppedPreview.set("/Placeholder4-5.png");
            }, 5000); // Show success preview for 5 seconds
        } catch (err) {
            error.set(`Upload failed: ${err.message}`);
        } finally {
            loading.set(false);
        }
    }
</script>

<svelte:head>
    <title>Product Image Upload | Admin</title>
</svelte:head>

<div class="container">
    <AdminHeader />

    <div class="panel">
        <h1 class="page-title">Upload Product Variant Images</h1>
        <p class="page-description">
            Upload and crop images for product variants. Images will be uploaded with a 4:5 aspect ratio for optimal
            display in the product catalog.
        </p>

        <!-- Main content layout: two columns for product selection and image cropping -->
        <div class="image-upload-layout">
            <!-- Left column: Product and variant selection -->
            <div class="selection-column">
                <div class="form-group">
                    <label for="product" class="form-label">Select Product</label>

                    <!-- Product search input -->
                    <div class="search-container">
                        <div class="search-icon">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search products..."
                            class="form-control search-input"
                            bind:value={$productSearch}
                            on:input={handleProductSearch}
                            disabled={$loading}
                        />
                        {#if $productSearch}
                            <button
                                class="clear-button"
                                aria-label="Clear product search"
                                on:click={() => {
                                    productSearch.set("");
                                    filterProducts("");
                                }}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    width="20"
                                    height="20"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </button>
                        {/if}
                    </div>

                    <!-- Product dropdown -->
                    <select
                        id="product"
                        class="select"
                        on:change={handleProductChange}
                        disabled={$loading}
                        size={$filteredProducts.length > 10 ? "10" : ""}
                        class:select-auto={$filteredProducts.length <= 10}
                        class:select-fixed={$filteredProducts.length > 10}
                    >
                        <option value="">Select a product</option>
                        {#each $filteredProducts as product}
                            <option value={product.id}>
                                {product.displayName || product.style} ({product.skuBase})
                            </option>
                        {/each}
                    </select>
                    <p class="small-text">{$filteredProducts.length} products found</p>
                </div>

                <div class="form-group">
                    <label for="variant" class="form-label">Select Variant</label>

                    <!-- Variant search input -->
                    <div class="search-container">
                        <div class="search-icon">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search variants..."
                            class="form-control search-input"
                            bind:value={$variantSearch}
                            on:input={handleVariantSearch}
                            disabled={!$selectedProduct || $loading}
                        />
                        {#if $variantSearch}
                            <button
                                class="clear-button"
                                aria-label="Clear variant search"
                                on:click={() => {
                                    variantSearch.set("");
                                    filterVariants("");
                                }}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    width="20"
                                    height="20"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </button>
                        {/if}
                    </div>

                    <!-- Variant dropdown -->
                    <select
                        id="variant"
                        class="select"
                        on:change={handleVariantChange}
                        disabled={!$selectedProduct || $loading}
                        size={$filteredVariants.length > 10 ? "10" : ""}
                        class:select-auto={$filteredVariants.length <= 10}
                        class:select-fixed={$filteredVariants.length > 10}
                    >
                        <option value="">Select a variant</option>
                        {#each $filteredVariants as variant}
                            <option value={variant.id}>
                                {variant.color || ""}
                                {variant.size || ""}
                                {#if variant.sku}({variant.sku}){/if}
                            </option>
                        {/each}
                    </select>
                    <p class="small-text">
                        {$filteredVariants.length} variants found
                        {#if $selectedProduct}for {$selectedProduct.displayName || $selectedProduct.style}{/if}
                    </p>
                </div>

                <!-- Selected variant preview -->
                {#if $selectedVariant}
                    <div class="variant-preview">
                        <h3 class="preview-title">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            Selected Variant Details
                        </h3>
                        <div class="preview-content">
                            <div class="preview-image">
                                {#if $selectedVariant.imgUrl}
                                    <img src={$selectedVariant.imgUrl} alt="Product Variant" />
                                {:else}
                                    <div class="w-full h-full flex items-center justify-center">
                                        <div class="text-center">
                                            <svg
                                                class="mx-auto w-12 h-12"
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="1"
                                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                />
                                            </svg>
                                            <p class="mt-2">No image</p>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                            <div class="preview-details">
                                <div class="detail-card">
                                    <p class="detail-label">Product</p>
                                    <p class="detail-value">{$selectedProduct.displayName || $selectedProduct.style}</p>
                                </div>
                                <div class="detail-card">
                                    <p class="detail-label">SKU</p>
                                    <p class="detail-value">{$selectedVariant.sku || "N/A"}</p>
                                </div>
                                <div class="detail-card">
                                    <p class="detail-label">Color</p>
                                    <div class="color-swatch">
                                        {#if $selectedVariant.colorHex}
                                            <div
                                                class="color-dot"
                                                style="background-color: {$selectedVariant.colorHex};"
                                            ></div>
                                        {/if}
                                        <p class="detail-value">{$selectedVariant.color || "N/A"}</p>
                                    </div>
                                </div>
                                <div class="detail-card">
                                    <p class="detail-label">Size</p>
                                    <p class="detail-value">{$selectedVariant.size || "N/A"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- File upload button -->
                <div class="form-group">
                    <h3 class="form-label">Upload New Image</h3>

                    <div class="drop-zone">
                        {#if !$selectedVariant}
                            <div class="flex flex-col items-center justify-center">
                                <svg
                                    class="upload-icon"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="1"
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                <p class="drop-text">Please select a product variant first</p>
                            </div>
                        {:else}
                            <label
                                for="image-upload"
                                class="cursor-pointer flex flex-col items-center justify-center h-full"
                            >
                                <svg
                                    class="upload-icon"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="1"
                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                </svg>
                                <p class="upload-text">Click to browse or drop image here</p>
                                <p class="drop-text-secondary">Supports JPG, PNG, GIF (max 10MB)</p>
                                <input
                                    type="file"
                                    id="image-upload"
                                    accept="image/*"
                                    on:change={handleFileSelect}
                                    class="file-input"
                                    disabled={$loading}
                                    bind:this={fileInput}
                                />
                                <button
                                    class="upload-button"
                                    on:click={() => {
                                        fileInput.click();
                                    }}
                                    disabled={$loading}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    Select Image
                                </button>
                            </label>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Right column: Image cropping area -->
            <div class="cropper-column">
                {#if $originalImage}
                    <!-- This is the container where Cropper.js 2.0 components will be inserted -->
                    <div class="cropper-container">
                        <!-- The Cropper.js 2.0 components will be inserted here by the handleFileSelect function -->
                    </div>

                    <div class="file-info">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </div>

                    <!-- Cropping options and upload button -->
                    <div class="cropper-controls">
                        <div class="controls-row">
                            <!-- Preview of the cropped image - always present with placeholder -->
                            <div class="preview-container">
                                <h3 class="preview-title">Preview</h3>
                                <div
                                    class="cropped-preview"
                                    class:placeholder={$croppedPreview === "/Placeholder4-5.png"}
                                >
                                    <img src={$croppedPreview} alt="Cropped Preview" />
                                </div>
                                <p class="preview-info">Upload an image and crop to see preview</p>
                            </div>
                            <div class="quality-control">
                                <label for="image-quality" class="quality-label">Image Quality</label>
                                <div class="quality-slider-container">
                                    <input
                                        id="image-quality"
                                        type="range"
                                        min="0.5"
                                        max="1"
                                        step="0.1"
                                        bind:value={quality}
                                        on:input={async () => {
                                            const size = await estimateFileSize();
                                            estimatedSize.set(size);
                                            // estimateFileSize already updates the preview
                                        }}
                                        class="quality-slider"
                                    />
                                    <span class="quality-value">{Math.round(quality * 100)}%</span>
                                </div>
                                <p class="quality-hint">
                                    {#if $estimatedSize}
                                        Estimated size:
                                        <span
                                            class="size-estimate"
                                            class:size-warning={parseFloat($estimatedSize) > 1.5}
                                        >
                                            {$estimatedSize} MB
                                        </span>
                                        {#if parseFloat($estimatedSize) > 1.5}
                                            <span class="size-warning-text">(Consider reducing quality)</span>
                                        {/if}
                                    {/if}
                                </p>
                            </div>
                            <div class="button-group">
                                <button
                                    on:click={resetCropper}
                                    class="button-reset"
                                    disabled={$loading || !$originalImage}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    >
                                        <path d="M3 2v6h6"></path>
                                        <path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
                                    </svg>
                                    Reset
                                </button>
                                <button
                                    on:click={uploadImage}
                                    class="button-upload"
                                    disabled={$loading || !$selectedVariant}
                                >
                                    {#if $loading}
                                        <div class="spinner"></div>
                                        Uploading...
                                    {:else}
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="17 8 12 3 7 8"></polyline>
                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                        Upload and Save
                                    {/if}
                                </button>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Status messages -->
        <div class="status-messages">
            {#if $error}
                <div class="alert alert-error">
                    <svg
                        class="alert-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div class="alert-content">
                        <p class="alert-title">Error</p>
                        <p class="alert-message">{$error}</p>
                    </div>
                </div>
            {/if}

            {#if $loading}
                <div class="alert alert-info">
                    <svg
                        class="alert-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <div class="alert-content">
                        <p class="alert-title">Loading</p>
                        <p class="alert-message">Loading products...</p>
                    </div>
                </div>
            {/if}

            {#if $success}
                <div class="alert alert-success">
                    <svg
                        class="alert-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <div class="alert-content">
                        <p class="alert-title">Success</p>
                        <p class="alert-message">{$success}</p>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Debug info in accordion -->
        <details class="debug-section">
            <summary class="debug-summary">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                </svg>
                Debug Information
            </summary>
            <div class="debug-content">
                <div class="debug-item">
                    <span class="debug-label">Backend URL:</span>
                    <span class="debug-value">{PUBLIC_BACKEND_URL}</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Products loaded:</span>
                    <span class="debug-value">{$products ? $products.length : 0}</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Filtered products:</span>
                    <span class="debug-value">{$filteredProducts ? $filteredProducts.length : 0}</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Selected product:</span>
                    <span class="debug-value"
                        >{$selectedProduct ? $selectedProduct.displayName || $selectedProduct.style : "None"}</span
                    >
                </div>
                <div class="debug-item">
                    <span class="debug-label">Variants available:</span>
                    <span class="debug-value">{$variants ? $variants.length : 0}</span>
                </div>
                <div class="debug-item">
                    <span class="debug-label">Image quality:</span>
                    <span class="debug-value">{Math.round(quality * 100)}%</span>
                </div>
            </div>
        </details>
    </div>
</div>

<style>
    /* Cropper.js v2.0.1 custom element styling - optimized for 4:5 ratio */
    :global(cropper-canvas) {
        display: block;
        width: auto;
        height: 100%;
        min-width: 500px; /* Increased height for 4:5 ratio */
        background-color: #f8f9fa;
    }

    .size-estimate {
        font-weight: 600;
        padding: 0.1rem 0.3rem;
        border-radius: 0.25rem;
        background-color: var(--color-primary-light);
        color: var(--color-primary);
        transition: all 0.2s ease-in-out;
    }

    .size-warning {
        background-color: var(--color-danger-light);
        color: var(--color-danger);
    }

    .size-warning-text {
        color: var(--color-danger);
        font-weight: 500;
        margin-left: 0.3rem;
        font-size: 0.75rem;
    }

    :global(cropper-image) {
        display: block;
    }

    :global(cropper-selection) {
        border: 2px solid var(--color-primary);
    }

    :global(cropper-handle) {
        background-color: var(--color-primary);
        opacity: 0.8;
        width: 10px;
        height: 10px;
    }

    :global(cropper-handle[action="move"]) {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: transparent;
        cursor: move;
        opacity: 0.1;
    }

    :global(cropper-handle:hover) {
        opacity: 1;
    }

    :global(cropper-grid) {
        border-color: rgba(var(--color-primary-rgb), 0.3);
    }

    :global(.cropper-container) {
        position: relative;
        direction: ltr;
        touch-action: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        height: 100%;
        width: auto;
        /* min-height: 700px; */
    }
    img {
        max-height: 100%;
        display: block;
    }
</style>
