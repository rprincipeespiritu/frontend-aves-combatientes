const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

const distPath = path.join(__dirname, "../dist");

function obfuscateFile(filePath) {
  const code = fs.readFileSync(filePath, "utf8");

  const result = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    rotateStringArray: true,
    selfDefending: true,
    disableConsoleOutput: true
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
      walk(fullPath);
    } else if (
      file.endsWith(".js") &&
      !file.includes("sap-ui") &&
      !file.includes("resources")
    ) {
      console.log("Ofuscando:", fullPath);
      obfuscateFile(fullPath);
    }
  });
}

walk(distPath);
console.log("Código JS ofuscado correctamente");