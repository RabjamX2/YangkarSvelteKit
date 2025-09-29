<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import AdminHeader from "../AdminHeader.svelte";
    import { createAuthFetch } from "$lib/utils/csrf";
    import { page } from "$app/stores";
    import "./image-upload.css";

    // Declare Cropper and instance variables
    let Cropper;
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
    const croppedImage = writable(null);
    const cropper = writable(null);
    const currentUser = writable(null); // Store current user info

    // Search filters
    const productSearch = writable("");
    const variantSearch = writable("");

    // Cropping related variables
    let imageElement;
    let cropperInstance;
    let fileInput;
    let aspectRatio = 4 / 5; // Fixed 4:5 aspect ratio
    let quality = 0.8; // Image compression quality (0-1)
    let maxWidth = 1000; // Maximum width for the uploaded image

    onMount(async () => {
        // Check for authentication first using JWT-based auth
        try {
            // Get current user info using our authenticated fetch utility
            const fetchAuth = createAuthFetch($page);
            const response = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/me`);

            const userData = await response.json();

            if (userData && userData.user) {
                console.log("User authenticated:", userData.user.username);
                currentUser.set(userData.user);
            } else {
                console.warn("Not authenticated");
                error.set("Please log in to upload images");
            }
        } catch (authErr) {
            console.error("Authentication check error:", authErr);
            error.set("Authentication error. Please try logging in again.");
        }

        // Load products data
        await loadProducts();

        // Dynamically import Cropper only in the browser
        try {
            // Import the cropper library only on the client side
            const CropperModule = await import("cropperjs");
            Cropper = CropperModule.default;
            console.log("Cropper.js loaded successfully", Cropper);
            console.log("Cropper version:", Cropper.VERSION || "unknown");
        } catch (err) {
            console.error("Failed to load Cropper.js:", err);
            error.set("Failed to load image cropping library. Please refresh the page.");
        }
    });

    // Load all products
    async function loadProducts() {
        loading.set(true);
        error.set(null);

        console.log("Backend URL:", PUBLIC_BACKEND_URL);

        try {
            // Use our authenticated fetch utility
            const fetchAuth = createAuthFetch($page);
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/products-with-variants?all=true`);
            console.log("Response status:", res.status);

            if (!res.ok) {
                throw new Error(`Error fetching products: ${res.statusText}`);
            }

            const data = await res.json();
            console.log("Products data:", data);
            // Access the data property from the response, matching products page behavior
            const productsData = data.data || data;
            products.set(productsData);
            filteredProducts.set(productsData);
            loading.set(false);
        } catch (err) {
            console.error("Failed to load products:", err);
            error.set(`Failed to load products: ${err.message}`);
            loading.set(false);
        }
    }

    // Filter products based on search term
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

    // Handle file selection
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check if file is an image
        if (!file.type.match("image.*")) {
            error.set("Please select an image file");
            return;
        }

        // Check if Cropper library is available
        if (!Cropper) {
            error.set("Image cropping library is not loaded. Please refresh the page.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage.set(e.target.result);
            success.set(null);
            error.set(null);

            // Destroy previous cropper if it exists
            if (cropperInstance) {
                cropperInstance.destroy();
            }

            // Initialize cropper after image is loaded
            setTimeout(() => {
                try {
                    // Check that Cropper is available
                    if (!Cropper) {
                        throw new Error("Cropper.js is not loaded");
                    }

                    // Check that the image element is available
                    if (!imageElement) {
                        throw new Error("Image element is not ready");
                    }

                    // Destroy previous cropper again just to be safe
                    if (cropperInstance && typeof cropperInstance.destroy === "function") {
                        cropperInstance.destroy();
                    }

                    // Create the cropper instance with explicit options for v2.0.1
                    cropperInstance = new Cropper(imageElement, {
                        // Core options
                        aspectRatio: aspectRatio,
                        view: {
                            mode: 1, // Changed from viewMode to view.mode in v2.0.1
                        },
                        autoCrop: true,
                        autoCropArea: 0.8,
                        // UI options
                        guides: true,
                        center: true,
                        highlight: false,
                        // Additional options
                        dragMode: "move",
                        responsive: true,
                        restore: false,
                        cropBoxMovable: true,
                        cropBoxResizable: true,
                        toggleDragModeOnDblclick: false,
                        minContainerWidth: 300,
                        minContainerHeight: 375,
                        ready: function () {
                            console.log("Cropper is ready");
                            console.log(
                                "Available methods:",
                                Object.getOwnPropertyNames(Object.getPrototypeOf(cropperInstance))
                            );
                        },
                    });

                    // Store the instance in the Svelte store as well
                    cropper.set(cropperInstance);

                    console.log("Cropper instance created successfully:", cropperInstance);
                    console.log("Cropper prototype:", Object.getPrototypeOf(cropperInstance));
                    console.log("Cropper methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(cropperInstance)));
                    // Verify that cropperInstance has the required methods
                    console.log(
                        "getCropperCanvas method exists:",
                        typeof cropperInstance.getCropperCanvas === "function"
                    );
                } catch (err) {
                    console.error("Error initializing Cropper:", err);
                    error.set("Failed to initialize image cropper: " + err.message);
                }
            }, 200);
        };
        reader.readAsDataURL(file);
    }

    // Compress and upload the image
    async function uploadImage() {
        if (!Cropper) {
            error.set("Image cropping library is not loaded. Please refresh the page.");
            return;
        }

        if (!cropperInstance || !$selectedVariant) {
            error.set("Please select an image and a product variant");
            console.error("Missing cropperInstance or selectedVariant:", {
                cropperExists: !!cropperInstance,
                selectedVariantExists: !!$selectedVariant,
            });
            return;
        }

        loading.set(true);
        error.set(null);
        success.set(null);

        try {
            // Log the cropper instance to debug
            console.log("Using cropperInstance:", cropperInstance);

            // Check if the cropper instance is properly initialized
            if (!cropperInstance) {
                throw new Error("Cropper is not properly initialized. Please reload the page and try again.");
            }

            // Check what methods are available
            const cropperMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(cropperInstance));
            console.log("Available methods:", cropperMethods);

            if (typeof cropperInstance.getCropperCanvas !== "function") {
                throw new Error("getCropperCanvas method is not available. Please reload the page and try again.");
            }

            // Get the cropped image
            console.log("Attempting to get cropped image...");

            // Let's check what methods are available for getting images
            console.log("cropperInstance methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(cropperInstance)));

            console.log("Using direct cropper API approach for Cropper.js 2.0");
            let blob;

            try {
                // Get the cropper canvas element
                const cropperCanvas = cropperInstance.getCropperCanvas({
                    maxWidth: maxWidth,
                    maxHeight: maxWidth * (5 / 4),
                    fillColor: "#fff",
                });

                console.log("Canvas element:", cropperCanvas);

                // Try to get image directly from cropperInstance
                blob = await cropperInstance.getCropperImage({
                    format: "image/jpeg",
                    quality: quality,
                    maxWidth: maxWidth,
                    maxHeight: maxWidth * (5 / 4),
                });

                // Log the result to see what we're getting back
                console.log("Result from getCropperImage:", blob);
                console.log("Result type:", typeof blob);
                console.log("Is instanceof Blob:", blob instanceof Blob);

                // If we didn't get a valid Blob, try to extract the image data
                if (!(blob instanceof Blob)) {
                    console.log("Result is not a Blob, trying to extract image data");

                    if (blob && blob.src && blob.src.startsWith("data:")) {
                        // The element has a data URL in its src attribute
                        console.log("Found data URL in cropper-image element");
                        try {
                            // Convert data URL to blob
                            const response = await fetch(blob.src);
                            blob = await response.blob();
                            console.log("Blob created from data URL:", blob instanceof Blob);
                        } catch (dataUrlError) {
                            console.error("Error converting data URL to blob:", dataUrlError);
                        }
                    } else if (
                        blob &&
                        blob.getAttribute &&
                        blob.getAttribute("src") &&
                        blob.getAttribute("src").startsWith("data:")
                    ) {
                        // Try getting src as an attribute
                        const dataUrl = blob.getAttribute("src");
                        console.log("Found data URL in src attribute");
                        try {
                            const response = await fetch(dataUrl);
                            blob = await response.blob();
                            console.log("Blob created from src attribute:", blob instanceof Blob);
                        } catch (attrError) {
                            console.error("Error converting attribute to blob:", attrError);
                        }
                    } else {
                        // Try to access the underlying canvas element as a fallback
                        console.log("No data URL found, trying canvas approach");
                        const canvasElement = cropperCanvas.querySelector("canvas");
                        if (canvasElement) {
                            console.log("Found canvas element inside cropperCanvas");
                            blob = await new Promise((resolve) => {
                                canvasElement.toBlob((b) => resolve(b), "image/jpeg", quality);
                            });
                            console.log("Blob created from inner canvas:", blob instanceof Blob);
                        }
                    }
                }
            } catch (blobError) {
                console.error("Error getting image blob:", blobError);

                // Fallback 1: Try to extract image from the cropper-image element directly
                try {
                    console.log("Trying to extract image data from cropper-image...");

                    // Get a fresh cropper image
                    const cropperImage = await cropperInstance.getCropperImage();
                    console.log("Got cropper-image element:", cropperImage);

                    if (cropperImage && cropperImage.tagName === "CROPPER-IMAGE") {
                        // Extract the data URL from the src attribute if possible
                        const imgSrc = cropperImage.getAttribute ? cropperImage.getAttribute("src") : cropperImage.src;
                        if (imgSrc && typeof imgSrc === "string" && imgSrc.startsWith("data:")) {
                            console.log("Found data URL in cropper-image");
                            try {
                                const response = await fetch(imgSrc);
                                blob = await response.blob();
                                console.log("Blob created from cropper-image src:", blob instanceof Blob);
                            } catch (srcError) {
                                console.error("Error getting blob from data URL:", srcError);
                            }
                        }
                    }

                    // If that didn't work, try with the canvas
                    if (!blob || !(blob instanceof Blob)) {
                        console.log("Using alternate approach with cropper canvas...");
                        const canvas = cropperInstance.getCropperCanvas();

                        // Use the raw canvas element directly
                        const rawCanvas = canvas.querySelector("canvas");
                        if (rawCanvas) {
                            console.log("Found raw canvas element inside cropper-canvas");
                            // Get blob from raw canvas
                            blob = await new Promise((resolve) => {
                                rawCanvas.toBlob((blobData) => resolve(blobData), "image/jpeg", quality);
                            });
                            console.log("Blob created from raw canvas:", blob instanceof Blob);
                        } else {
                            console.error("No raw canvas element found");
                        }
                    }
                } catch (rawCanvasError) {
                    console.error("Raw canvas error:", rawCanvasError);
                }

                // Fallback 2: Try creating a new canvas manually
                if (!blob) {
                    try {
                        console.log("Using manual canvas fallback approach...");
                        // Create a standard canvas
                        const regularCanvas = document.createElement("canvas");
                        const ctx = regularCanvas.getContext("2d");

                        // Get dimensions from the cropper selection
                        const selection = cropperInstance.getCropperSelection();
                        console.log("Selection data:", selection);

                        const width = Math.min(selection.width, maxWidth);
                        const height = Math.min(selection.height, maxWidth * (5 / 4));

                        // Set canvas dimensions
                        regularCanvas.width = width;
                        regularCanvas.height = height;

                        // Draw the cropped image onto the canvas
                        ctx.drawImage(
                            imageElement,
                            selection.x,
                            selection.y,
                            selection.width,
                            selection.height,
                            0,
                            0,
                            width,
                            height
                        );

                        // Get blob from regular canvas
                        blob = await new Promise((resolve) => {
                            regularCanvas.toBlob((blobData) => resolve(blobData), "image/jpeg", quality);
                        });

                        console.log("Blob created from manual canvas fallback:", blob instanceof Blob);
                    } catch (canvasError) {
                        console.error("Canvas fallback error:", canvasError);
                        throw new Error("Failed to create image: " + canvasError.message);
                    }
                }
            }

            // Last-resort attempt: Get the data URL directly from the src attribute of cropper-image
            if (!blob || !(blob instanceof Blob)) {
                try {
                    console.log("Making final attempt to extract image data");
                    const cropperImage = await cropperInstance.getCropperImage();

                    // Try accessing the src as a property or attribute
                    let dataUrl = null;

                    // Check if src is available directly as a property
                    if (cropperImage && cropperImage.src) {
                        dataUrl = cropperImage.src;
                    }
                    // Try accessing it as an attribute
                    else if (cropperImage && cropperImage.getAttribute) {
                        dataUrl = cropperImage.getAttribute("src");
                    }
                    // Try accessing the property via the DOM
                    else if (cropperImage) {
                        dataUrl = cropperImage["src"];
                    }

                    if (dataUrl && dataUrl.startsWith("data:")) {
                        console.log("Found data URL in final attempt");
                        // Extract the base64 part of the data URL
                        const base64String = dataUrl.split(",")[1];
                        if (base64String) {
                            // Convert base64 to binary
                            const byteCharacters = atob(base64String);
                            const byteArrays = [];

                            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                                const slice = byteCharacters.slice(offset, offset + 512);

                                const byteNumbers = new Array(slice.length);
                                for (let i = 0; i < slice.length; i++) {
                                    byteNumbers[i] = slice.charCodeAt(i);
                                }

                                const byteArray = new Uint8Array(byteNumbers);
                                byteArrays.push(byteArray);
                            }

                            // Create blob from binary
                            const type = dataUrl.split(";")[0].split(":")[1] || "image/jpeg";
                            blob = new Blob(byteArrays, { type });
                            console.log("Successfully created blob from base64 data:", blob instanceof Blob);
                        }
                    }
                } catch (finalError) {
                    console.error("Final attempt error:", finalError);
                }
            }

            // Validate that we got a proper blob
            if (!blob || !(blob instanceof Blob)) {
                throw new Error("Failed to create a valid image blob");
            } // Create form data with the blob
            const formData = new FormData();
            formData.append("image", blob, "product-image.jpg");

            console.log("FormData created, uploading...");

            console.log("Proceeding with upload using cookie authentication");

            // Upload to backend with CSRF protection
            const fetchAuth = createAuthFetch($page);
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/upload-image`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                // More detailed error for debugging
                let errorDetails = `Status: ${res.status} ${res.statusText}`;
                try {
                    // Try to get error details from response body if available
                    const errorResponse = await res.text();
                    errorDetails += ` - ${errorResponse}`;
                } catch (e) {
                    // If can't read response body, use standard error
                    errorDetails += " (No additional error details available)";
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
                // More detailed error for updating variant
                let errorDetails = `Status: ${updateRes.status} ${updateRes.statusText}`;
                try {
                    const errorResponse = await updateRes.text();
                    errorDetails += ` - ${errorResponse}`;
                } catch (e) {
                    errorDetails += " (No additional error details available)";
                }

                throw new Error(`Failed to update variant: ${errorDetails}`);
            }

            const updateResult = await updateRes.json();
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

            loading.set(false);
        } catch (err) {
            console.error("Upload failed:", err);
            error.set(`Upload failed: ${err.message}`);
            loading.set(false);
        }
    }
</script>

<svelte:head>
    <!-- Import Cropper.js stylesheet from our static directory -->
    <link rel="stylesheet" href="/cropperjs/cropper.min.css" />
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

        <!-- Product and variant selection -->
        <div class="grid">
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
                                    <div class="color-dot" style="background-color: {$selectedVariant.colorHex};"></div>
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

        <!-- File upload and cropping interface -->
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
                    <label for="image-upload" class="cursor-pointer flex flex-col items-center justify-center h-full">
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

        <!-- Image cropping area -->
        <div class="form-group">
            {#if $originalImage}
                <!-- This is the image element that Cropper will use -->
                <div class="cropper-container">
                    <img src={$originalImage} alt="Product to crop" bind:this={imageElement} class="cropper" />
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
                    <span>Drag to position • Use corners to resize • Scroll to zoom</span>
                </div>

                <!-- Cropping options and upload button -->
                <div class="cropper-controls">
                    <div class="controls-row">
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
                                    class="quality-slider"
                                />
                                <span class="quality-value">{Math.round(quality * 100)}%</span>
                            </div>
                            <p class="quality-hint">Higher quality = larger file size</p>
                        </div>
                        <div class="button-group">
                            <button
                                on:click={() => {
                                    if (cropperInstance) {
                                        // In Cropper.js 2.0, the reset method might have changed
                                        if (typeof cropperInstance.reset === "function") {
                                            cropperInstance.reset();
                                            console.log("Cropper reset called with instance:", cropperInstance);
                                        } else if (typeof cropperInstance.resetImage === "function") {
                                            // Try the new method name if it exists
                                            cropperInstance.resetImage();
                                            console.log("Cropper resetImage called with instance:", cropperInstance);
                                        } else {
                                            console.error("Cannot reset: no reset method found on cropperInstance");
                                        }
                                    } else {
                                        console.error("Cannot reset: cropperInstance is not available");
                                    }
                                }}
                                class="button-reset"
                                disabled={$loading || !cropperInstance}
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
    /* Hide the default cropper border to enforce our own styling */
    :global(.cropper-view-box) {
        outline: none !important;
        box-shadow: 0 0 0 1px rgba(var(--color-primary-rgb), 0.5) !important;
    }

    :global(.cropper-crop-box) {
        border: 2px solid var(--color-primary);
    }

    :global(.cropper-point) {
        background-color: var(--color-primary);
        opacity: 0.8;
        width: 10px;
        height: 10px;
    }

    :global(.cropper-point:hover) {
        opacity: 1;
    }

    :global(.cropper-point.point-n),
    :global(.cropper-point.point-s),
    :global(.cropper-point.point-e),
    :global(.cropper-point.point-w) {
        display: none;
    }

    :global(.cropper-line) {
        background-color: var(--color-primary);
    }

    :global(.cropper-dashed) {
        border-color: rgba(var(--color-primary-rgb), 0.3);
    }

    /* Make sure all images respect their container dimensions */
    img {
        max-width: 100%;
        display: block;
    }
</style>
