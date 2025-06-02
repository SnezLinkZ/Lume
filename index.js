const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Serve static files from public directory
app.use("/icons", express.static(path.join(__dirname, "public/icons")));

// API endpoint to get all icons
app.get("/api/icons", async (req, res) => {
  try {
    const iconsDir = path.join(__dirname, "public/icons");
    const files = await fs.readdir(iconsDir);

    // Filter for SVG files only
    const svgFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".svg",
    );

    // Get file stats for each icon
    const iconData = await Promise.all(
      svgFiles.map(async (filename) => {
        const filepath = path.join(iconsDir, filename);
        const stats = await fs.stat(filepath);
        const content = await fs.readFile(filepath, "utf8");

        // Extract some basic info from SVG
        const name = path.parse(filename).name;
        const size = stats.size;
        const lastModified = stats.mtime;

        // Try to extract viewBox for dimensions
        const viewBoxMatch = content.match(/viewBox=["']([^"']+)["']/);
        let dimensions = "Unknown";
        if (viewBoxMatch) {
          const viewBox = viewBoxMatch[1].split(" ");
          if (viewBox.length >= 4) {
            dimensions = `${viewBox[2]}×${viewBox[3]}`;
          }
        }

        return {
          filename,
          name,
          size,
          dimensions,
          lastModified,
          url: `/icons/${filename}`,
          downloadUrl: `/api/download/${filename}`,
        };
      }),
    );

    res.json(iconData);
  } catch (error) {
    console.error("Error reading icons directory:", error);
    res.status(500).json({ error: "Failed to read icons directory" });
  }
});

// API endpoint to download a specific icon
app.get("/api/download/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, "public/icons", filename);

    // Check if file exists and is SVG
    if (!filename.endsWith(".svg")) {
      return res.status(400).json({ error: "Only SVG files are allowed" });
    }

    const content = await fs.readFile(filepath, "utf8");

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error("Error downloading icon:", error);
    res.status(404).json({ error: "Icon not found" });
  }
});

// Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Icon Explorer server running on http://localhost:${PORT}`);
});