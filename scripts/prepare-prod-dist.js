const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const sourceMapComment = /^\s*\/\/# sourceMappingURL=.*$/gm;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

for (const file of walk(distDir)) {
  if (file.endsWith(".map") || file.endsWith(".ts")) {
    fs.rmSync(file, { force: true });
    continue;
  }

  if (file.endsWith(".js")) {
    const content = fs.readFileSync(file, "utf8");
    const cleaned = content.replace(sourceMapComment, "");
    if (cleaned !== content) {
      fs.writeFileSync(file, cleaned, "utf8");
    }
  }
}

console.log("Production dist prepared: source maps and TypeScript sources removed.");
