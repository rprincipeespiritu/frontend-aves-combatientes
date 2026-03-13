const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "dist", "config.js");
const apiBaseUrl = process.env.API_BASE_URL || "";

if (!fs.existsSync(filePath)) {
    console.error("No existe dist/config.js");
    process.exit(1);
}

let content = fs.readFileSync(filePath, "utf8");
content = content.replace("__API_BASE_URL__", apiBaseUrl);
fs.writeFileSync(filePath, content, "utf8");

console.log("config.js actualizado con API_BASE_URL =", apiBaseUrl);