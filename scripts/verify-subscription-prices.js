// Ejecuta el controlador real con transporte y controles UI simulados, sin cobros.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const models = {};
class JSONModel {
  constructor(data) { this.data = data; }
  setData(data) { this.data = data; }
  getProperty(key) { return key.split("/").filter(Boolean).reduce((v, k) => v?.[k], this.data); }
}
class Controller {
  getView() { return { setModel: (m, name) => { models[name] = m; }, getModel: (name) => models[name] }; }
  getOwnerComponent() { return { getRouter: () => ({ getRoute: () => undefined }) }; }
}
let confirmation = "";
let errors = 0;
let ok = true;
let catalog = ["BASICO", "PRO", "PREMIUM"].map((plan, i) => ({ plan, precioMensual: ["19.90", "34.90", "59.90"][i], moneda: "PEN" }));
const source = fs.readFileSync(path.join(__dirname, "../webapp/controller/Suscripcion.controller.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exportsObject = {};
vm.runInNewContext(js, {
  exports: exportsObject,
  require: (name) => {
    if (name.endsWith("/Controller")) return { default: Controller };
    if (name.endsWith("/JSONModel")) return { default: JSONModel };
    if (name.endsWith("/AuthService")) return { AuthService: { getInstance: () => ({}) } };
    if (name.endsWith("/MessageBox")) return { default: { error: () => { errors++; }, confirm: (text) => { confirmation = text; }, Action: { OK: "OK", CANCEL: "CANCEL" } } };
    return { default: {} };
  },
  localStorage: { getItem: () => "test-token" },
  fetch: async (url, options) => {
    assert.ok(url.endsWith("/obtenerPlanesSuscripcion"));
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return { ok, json: async () => ({ planes: catalog }) };
  },
});

(async () => {
  const controller = new exportsObject.default();
  controller.onInit();
  assert.equal(models.planes.getProperty("/disponible"), false);
  await controller.cargarPlanes();
  assert.equal(models.planes.getProperty("/disponible"), true);
  assert.equal(models.planes.getProperty("/PREMIUM/precioFmt"), "59.90");
  // Un cambio futuro del servidor debe reflejarse sin recompilar el frontend.
  catalog[0].precioMensual = "21.75";
  await controller.cargarPlanes();
  controller.confirmarActivacion("BASICO");
  assert.ok(confirmation.includes("21.75 PEN / mes"));
  ok = false;
  await controller.cargarPlanes();
  assert.equal(models.planes.getProperty("/disponible"), false);
  assert.equal(models.planes.getProperty("/BASICO"), undefined);
  confirmation = "";
  controller.confirmarActivacion("BASICO");
  assert.equal(confirmation, "");
  ok = true;
  catalog = catalog.slice(0, 1);
  await controller.cargarPlanes();
  assert.equal(models.planes.getProperty("/disponible"), false);
  assert.equal(errors, 2);
  console.log("OK: precios remotos, decimales, confirmacion y bloqueo ante error/catalogo incompleto.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
