let allIcons = [];
let filteredIcons = [];
let groupedIcons = new Map(); // Icons grouped by base name
let regexMode = false; // Track if regex mode is enabled

// Icon cache to store SVG content and avoid re-loading
const iconCache = new Map();
const loadingPromises = new Map(); // Track ongoing loads to avoid duplicates

// Icon versions in order of preference
const iconVersions = [
    "filled",
    "solid",
    "stroke",
    "duo_solid",
    "duo_stroke",
    "contrast",
    "bold",
];
const defaultVersion = "filled";

// Loading state management
let iconsLoaded = false;
let totalIconsToLoad = 0;
let iconsLoadedCount = 0;

// Load icons on page load
document.addEventListener("DOMContentLoaded", loadIcons);

// Search functionality
document.getElementById("searchInput").addEventListener("input", (e) => {
    filterIcons();
});

// Sort functionality
document.getElementById("sortBy").addEventListener("change", (e) => {
    filterIcons();
});

// View size functionality
document.getElementById("viewSize").addEventListener("change", (e) => {
    updateViewSize();
});

// Regex toggle functionality
document.getElementById("regexToggle").addEventListener("click", () => {
    toggleRegexMode();
});

async function loadIcons() {
    try {
        showLoadingScreen();

        const response = await fetch("/api/icons");
        if (!response.ok) throw new Error("Failed to load icons");

        allIcons = await response.json();

        // Group icons by base name
        groupIconsByBaseName();

        // Create filtered list from grouped icons
        filteredIcons = Array.from(groupedIcons.values());
        totalIconsToLoad = allIcons.length;

        // Pre-load all SVG icons into cache
        await preloadAllIcons();

        iconsLoaded = true;
        filterIcons();
    } catch (error) {
        console.error("Error loading icons:", error);
        document.getElementById("iconsContainer").innerHTML = `
                    <div class="no-results">
                        Failed to load icons. Please make sure your server is running and you have SVG files in the /public/icons directory.
                    </div>
                `;
    }
}

function groupIconsByBaseName() {
    groupedIcons.clear();

    allIcons.forEach((icon) => {
        const { baseName, version } = parseIconName(icon.name);

        if (!groupedIcons.has(baseName)) {
            groupedIcons.set(baseName, {
                baseName,
                versions: new Map(),
                defaultVersion: null,
                // Use first icon's metadata as base, will be updated with preferred version
                size: icon.size,
                dimensions: icon.dimensions,
            });
        }

        const group = groupedIcons.get(baseName);
        group.versions.set(version, icon);

        // Update group metadata with preferred version or first available
        if (
            !group.defaultVersion ||
            shouldPreferVersion(version, group.defaultVersion)
        ) {
            group.defaultVersion = version;
            group.size = icon.size;
            group.dimensions = icon.dimensions;
            group.url = icon.url;
            group.filename = icon.filename;
        }
    });
}

function parseIconName(filename) {
    // Remove .svg extension
    const nameWithoutExt = filename.replace(/\.svg$/, "");

    // Find which version suffix this icon has
    for (const version of iconVersions) {
        if (nameWithoutExt.endsWith("-" + version)) {
            const baseName = nameWithoutExt.slice(0, -(version.length + 1));
            return { baseName, version };
        }
    }

    // If no version suffix found, treat the whole name as base with 'filled' as default
    return { baseName: nameWithoutExt, version: "filled" };
}

function shouldPreferVersion(newVersion, currentVersion) {
    const newIndex = iconVersions.indexOf(newVersion);
    const currentIndex = iconVersions.indexOf(currentVersion);

    // If new version is 'filled' (our preferred default), prefer it
    if (newVersion === defaultVersion) return true;
    if (currentVersion === defaultVersion) return false;

    // Otherwise prefer earlier in the iconVersions array
    return newIndex < currentIndex && newIndex !== -1;
}

async function preloadAllIcons() {
    const loadPromises = allIcons.map((icon) =>
        preloadIcon(icon.url, icon.filename),
    );
    await Promise.all(loadPromises);
}

async function preloadIcon(url, filename) {
    if (iconCache.has(filename)) {
        return iconCache.get(filename);
    }

    // Check if we're already loading this icon
    if (loadingPromises.has(filename)) {
        return loadingPromises.get(filename);
    }

    const loadPromise = (async () => {
        try {
            const response = await fetch(url);
            const svgText = await response.text();

            // Process the SVG to ensure it displays correctly
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
            const svg = svgDoc.querySelector("svg");

            if (svg) {
                svg.setAttribute("width", "48");
                svg.setAttribute("height", "48");
                const processedSvg = svg.outerHTML;
                iconCache.set(filename, processedSvg);

                iconsLoadedCount++;
                updateLoadingProgress();

                return processedSvg;
            } else {
                throw new Error("Invalid SVG");
            }
        } catch (error) {
            console.error(`Error loading SVG ${filename}:`, error);
            const fallbackSvg = `
                        <div style="display: flex; align-items: center; justify-content: center; height: 48px; color: #cbd5e0; font-size: 12px;">
                            SVG
                        </div>
                    `;
            iconCache.set(filename, fallbackSvg);
            iconsLoadedCount++;
            updateLoadingProgress();
            return fallbackSvg;
        } finally {
            loadingPromises.delete(filename);
        }
    })();

    loadingPromises.set(filename, loadPromise);
    return loadPromise;
}

function showLoadingScreen() {
    const container = document.getElementById("iconsContainer");
    container.className = "loading-screen";
    container.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <h2>Loading Lume Icons</h2>
                    <p>Gathering the collection...</p>
                    <div class="loading-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <div class="progress-text" id="progressText">0%</div>
                    </div>
                </div>
            `;
}

function updateLoadingProgress() {
    if (totalIconsToLoad === 0) return;

    const percentage = Math.round((iconsLoadedCount / totalIconsToLoad) * 100);
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    if (progressFill && progressText) {
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}% (${iconsLoadedCount}/${totalIconsToLoad})`;
    }
}

function filterIcons() {
    const searchTerm = document.getElementById("searchInput").value;
    const sortBy = document.getElementById("sortBy").value;
    const iconType = document.getElementById("iconType").value;

    // Filter grouped icons by search term
    if (regexMode && searchTerm.trim()) {
        try {
            const regex = new RegExp(searchTerm, "i");
            filteredIcons = Array.from(groupedIcons.values()).filter(
                (iconGroup) => regex.test(iconGroup.baseName),
            );
        } catch (error) {
            // Invalid regex - show no results
            filteredIcons = [];
        }
    } else {
        // Normal string search (case-insensitive)
        const lowerSearchTerm = searchTerm.toLowerCase();
        filteredIcons = Array.from(groupedIcons.values()).filter((iconGroup) =>
            iconGroup.baseName.toLowerCase().includes(lowerSearchTerm),
        );
    }

    //document.body.innerHTML = JSON.stringify(filteredIcons);
    /*filteredIcons = filteredIcons.filter(
        (iconGroup) =>
            (iconType === "legacy") ===
                (iconGroup.defaultVersion === "filled") || iconType === "all",
    );*/

    // Sort icon groups
    filteredIcons.sort((a, b) => {
        switch (sortBy) {
            case "name":
                return a.baseName.localeCompare(b.baseName);
            case "name-desc":
                return b.baseName.localeCompare(a.baseName);
            case "size":
                return a.size - b.size;
            default:
                return 0;
        }
    });

    renderIcons();
    updateStats();
}

function renderIcons() {
    const container = document.getElementById("iconsContainer");

    if (filteredIcons.length === 0) {
        container.innerHTML = `
                    <div class="no-results">
                        No icons found matching your search criteria.
                    </div>
                `;
        return;
    }

    container.innerHTML = "";
    container.className = "icons-grid";

    filteredIcons.forEach((iconGroup) => {
        const iconCard = createIconCard(iconGroup);
        container.appendChild(iconCard);
    });
}

function createIconCard(iconGroup) {
    const card = document.createElement("div");
    card.className = "icon-card";

    // Get current selected version or default
    const currentVersion = iconGroup.defaultVersion;
    const currentIcon = iconGroup.versions.get(currentVersion);

    const sizeInKB = (currentIcon.size / 1024).toFixed(1);

    // Create version options
    const versionOptions = Array.from(iconGroup.versions.keys())
        .sort((a, b) => iconVersions.indexOf(a) - iconVersions.indexOf(b))
        .map((version) => {
            const selected = version === currentVersion ? "selected" : "";
            const versionLabel =
                version.charAt(0).toUpperCase() +
                version.slice(1).replace("-", " ");
            return `<option value="${version}" ${selected}>${versionLabel}</option>`;
        })
        .join("")
        .replace("Duo_solid", "Duo Solid")
        .replace("Duo_stroke", "Duo Stroke")
        .replace("Bold", "Stroke");

    card.innerHTML = `
                <div class="icon-preview" data-icon-group="${iconGroup.baseName}">
                    <svg width="48" height="48" viewBox="0 0 24 24">
                        <use href="${currentIcon.url}#icon"></use>
                    </svg>
                </div>
                <div class="icon-name">${iconGroup.baseName}</div>
                <div class="version-selector">
                    <select onchange="changeIconVersion('${iconGroup.baseName}', this.value)">
                        ${versionOptions}
                    </select>
                </div>
                <!--<div class="icon-details">
                    ${currentIcon.dimensions} • ${sizeInKB} KB<br>
                </div>-->
                <div class="icon-actions">
                    <button class="btn btn-primary" onclick="downloadIcon('${currentIcon.filename}')">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13 4C13 3.44772 12.5523 3 12 3C11.4477 3 11 3.44772 11 4V11.3216C10.3658 11.2997 9.73211 11.257 9.10001 11.1935C8.70512 11.1538 8.32413 11.3514 8.12909 11.697C7.93404 12.0427 7.96187 12.471 8.2 12.7885C8.98959 13.8413 9.90559 14.792 10.9269 15.6196C11.2392 15.8726 11.6199 16 12 16C12.3801 16 12.7608 15.8726 13.0731 15.6195C14.0944 14.792 15.0104 13.8413 15.8 12.7885C16.0381 12.471 16.066 12.0427 15.8709 11.697C15.6759 11.3514 15.2949 11.1538 14.9 11.1935C14.2679 11.257 13.6342 11.2997 13 11.3216V4Z" fill="#ffffff"/>
<path d="M4 15C4 14.4477 3.55228 14 3 14C2.44772 14 2 14.4477 2 15C2 18.3137 4.68629 21 8 21H16C19.3137 21 22 18.3137 22 15C22 14.4477 21.5523 14 21 14C20.4477 14 20 14.4477 20 15C20 17.2091 18.2091 19 16 19H8C5.79086 19 4 17.2091 4 15Z" fill="#ffffff"/>
</svg>
                    </button>
                    <button class="btn btn-secondary" onclick="copyIcon('${currentIcon.url}')">
                        <svg width="25" height="24" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11.5 19.5H17.2C16.61 20.97 15.18 22 13.5 22H6.5C4.29 22 2.5 20.21 2.5 18V10C2.5 7.96 4.03 6.28003 6 6.03003V14C6 17.03 8.47 19.5 11.5 19.5ZM20 6.25H22.12C22.06 6.16 21.99 6.08 21.91 6L18.5 2.59009C18.42 2.51009 18.34 2.43989 18.25 2.38989V4.5C18.25 5.46 19.04 6.25 20 6.25ZM20 7.75C18.21 7.75 16.75 6.29 16.75 4.5V2H11.5C9.29 2 7.5 3.79 7.5 6V14C7.5 16.21 9.29 18 11.5 18H18.5C20.71 18 22.5 16.21 22.5 14V7.75H20Z" fill="black"/>
</svg>

                    </button>
                </div>
            `;

    // Load the cached SVG content instantly
    loadCachedSVGPreview(
        card.querySelector(".icon-preview"),
        currentIcon.filename,
    );

    return card;
}

function loadCachedSVGPreview(container, filename) {
    const cachedSvg = iconCache.get(filename);
    if (cachedSvg) {
        container.innerHTML = cachedSvg;
    } else {
        // Fallback if somehow not cached
        container.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 48px; color: #cbd5e0; font-size: 12px;">
                        SVG
                    </div>
                `;
    }
}

async function loadSVGPreview(container, url) {
    try {
        const response = await fetch(url);
        const svgText = await response.text();
        container.innerHTML = svgText;

        const svg = container.querySelector("svg");
        if (svg) {
            svg.setAttribute("width", "48");
            svg.setAttribute("height", "48");
        }
    } catch (error) {
        console.error("Error loading SVG preview:", error);
        container.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 48px; color: #cbd5e0; font-size: 12px;">
                        SVG
                    </div>
                `;
    }
}

function updateStats() {
    const totalGroups = groupedIcons.size;
    const showing = filteredIcons.length;
    const totalIcons = allIcons.length;
    const statsElement = document.getElementById("stats");

    if (totalGroups === showing) {
        statsElement.textContent = `Showing all ${totalGroups} icons (${totalIcons} total variants)`;
    } else {
        statsElement.textContent = `Showing ${showing} of ${totalGroups} icons (${totalIcons} total variants)`;
    }
}

function changeIconVersion(baseName, newVersion) {
    const iconGroup = groupedIcons.get(baseName);
    if (!iconGroup || !iconGroup.versions.has(newVersion)) return;

    const newIcon = iconGroup.versions.get(newVersion);
    const card = document
        .querySelector(`[data-icon-group="${baseName}"]`)
        .closest(".icon-card");

    // Update the preview
    const preview = card.querySelector(".icon-preview");
    loadCachedSVGPreview(preview, newIcon.filename);

    // Update the details
    const sizeInKB = (newIcon.size / 1024).toFixed(1);

    const details = card.querySelector(".icon-details");
    details.innerHTML = `
                ${newIcon.dimensions} • ${sizeInKB} KB<br>
            `;

    // Update the download button
    const downloadBtn = card.querySelector(".btn-primary");
    downloadBtn.setAttribute("onclick", `downloadIcon('${newIcon.filename}')`);

    // Update the copy URL button
    const copyBtn = card.querySelector(".btn-secondary");
    copyBtn.setAttribute("onclick", `copyIcon('${newIcon.url}')`);
}

function updateViewSize() {
    const viewSize = document.getElementById("viewSize").value;
    const grid = document.querySelector(".icons-grid");

    if (!grid) return;

    switch (viewSize) {
        case "small":
            grid.style.gridTemplateColumns =
                "repeat(auto-fill, minmax(150px, 1fr))";
            break;
        case "large":
            grid.style.gridTemplateColumns =
                "repeat(auto-fill, minmax(280px, 1fr))";
            break;
        default: // medium
            grid.style.gridTemplateColumns =
                "repeat(auto-fill, minmax(200px, 1fr))";
    }
}

function toggleRegexMode() {
    regexMode = !regexMode;
    const toggleButton = document.getElementById("regexToggle");
    const searchInput = document.getElementById("searchInput");

    if (regexMode) {
        toggleButton.classList.add("active");
        searchInput.placeholder =
            "Search icons with regex (e.g., ^arrow|calendar$)...";
    } else {
        toggleButton.classList.remove("active");
        searchInput.placeholder = "Search icons by name...";
    }

    // Re-filter with current search term
    filterIcons();
}

async function downloadIcon(filename) {
    try {
        const response = await fetch(`/api/download/${filename}`);
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error downloading icon:", error);
        alert("Failed to download icon");
    }
}

async function copyIcon(url) {
    try {
        // Fetch the SVG content
        const response = await fetch(url);
        const svgContent = await response.text();

        await navigator.clipboard.writeText(svgContent);

        // Simple feedback - you could enhance this with a toast notification
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        btn.style.background = "#48bb78";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = "";
        }, 1500);
    } catch (err) {
        console.error("Failed to copy SVG:", err);
    }
}
