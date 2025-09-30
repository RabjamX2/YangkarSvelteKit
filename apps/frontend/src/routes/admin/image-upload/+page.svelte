<script>
    // @ts-nocheck
    import { onMount } from "svelte";
    import { writable } from "svelte/store";
    import AdminHeader from "../AdminHeader.svelte";
    import { createAuthFetch } from "$lib/utils/csrf";
    import { page } from "$app/stores";
    import "./image-upload.css";
    import "./cropper-essential.css";
    import "./layout.css";

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
    const currentUser = writable(null);

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

    function makeCanvasHTML(img) {
        return `
            <cropper-canvas background>
                <cropper-image src="${img}" scalable rotatable translatable alt="Image"></cropper-image>
                <cropper-shade hidden></cropper-shade>
                <cropper-selection movable resizable aspect-ratio="${aspectRatio}" zoomable id="main-selection" initial-coverage="1.0">
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
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.match("image.*")) {
            error.set("Please select an image file");
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

            // Initialize cropper with a slight delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    const container = document.querySelector(".cropper-container");
                    if (!container) {
                        throw new Error("Cropper container element is not ready");
                    }

                    // Clear and initialize cropper web components
                    container.innerHTML = makeCanvasHTML(e.target.result);
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
                container.innerHTML = "";
                container.innerHTML = makeCanvasHTML($originalImage);
            }
        } catch (error) {
            console.error("Error during reset:", error);
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

            // Convert canvas to blob
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Canvas toBlob returned null"));
                        }
                    },
                    "image/jpeg",
                    quality
                );
            });

            // Create form data with the blob
            const formData = new FormData();
            formData.append("image", blob, "product-image.jpg");

            // Upload to backend with CSRF protection
            const fetchAuth = createAuthFetch($page);
            const res = await fetchAuth(`${PUBLIC_BACKEND_URL}/api/upload-image`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                let errorDetails = `Status: ${res.status} ${res.statusText}`;
                try {
                    const errorResponse = await res.text();
                    errorDetails += ` - ${errorResponse}`;
                } catch (e) {
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
