const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

const distPath = path.join(__dirname, "../dist");

function obfuscateFile(filePath) {
  const code = fs.readFileSync(filePath, "utf8")
    .replace(/^\/\/# sourceMappingURL=.*$/gm, "");

  const result = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    // Keep call signatures intact: the previous transformations dropped fetch options.
    controlFlowFlattening: false,
    deadCodeInjection: false,
    stringArrayCallsTransform: false,
    renameGlobals: false,
    renameProperties: false,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    stringArrayRotate: true,
    selfDefending: false,
    disableConsoleOutput: false,
    sourceMap: false,
    seed: 20261005
  });

  fs.writeFileSync(filePath, result.getObfuscatedCode(), "utf8");
}

function walk(dir) {
  if (!fs.existsSync(dir)) {
    console.error("No existe la carpeta dist. Ejecuta primero ui5 build.");
    process.exit(1);
  }

  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      // UI5/vendor libraries are already built and must not be transformed.
      if (!["resources", "test-resources"].includes(file)) walk(fullPath);
    } else if (file.endsWith(".ts") || file.endsWith(".map")) {
      // Only generated files inside dist; do not publish unobfuscated app sources.
      fs.unlinkSync(fullPath);
    } else if (file.endsWith(".js") && !file.startsWith("sap-ui")) {
      console.log("Ofuscando:", fullPath);
      obfuscateFile(fullPath);
    }
  });
}

walk(distPath);
console.log("Código JS ofuscado correctamente");
