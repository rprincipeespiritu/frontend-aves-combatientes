// Exercise the generated UI5 modules without contacting the API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function verify(file) {
  let Component;
  let modules;
  let received;
  let failure;
  const response = { ok: true };
  function UI5Stub() {}
  UI5Stub.extend = (_name, prototype) => {
    function BuiltComponent() {}
    BuiltComponent.prototype = prototype;
    return BuiltComponent;
  };
  const window = {
    fetch: async (...args) => {
      received = args;
      if (failure) throw failure;
      return response;
    },
  };
  const context = vm.createContext({
    window, URL, Request,
    sap: { ui: {
      require: { preload: (entries) => { modules = entries; } },
      define: (dependencies, factory) => {
        Component = factory(...dependencies.map(() => UI5Stub));
      },
    } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../dist", file), "utf8"), context, { timeout: 5000 });
  if (modules) {
    modules["com/rprincipees/registroavescombate/Component.js"]();
  }
  let pending = 0;
  const component = Object.create(Component.prototype);
  component.openFetchBusyDialog = () => { pending += 1; };
  component.closeFetchBusyDialog = () => { pending -= 1; };
  component.installGlobalFetchBusyDialog();
  const wrappedFetch = window.fetch;
  component.installGlobalFetchBusyDialog();
  assert.equal(window.fetch, wrappedFetch, "fetch must only be wrapped once");

  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.invalid", password: "test-only" }),
    credentials: "include",
    signal: new AbortController().signal,
  };
  assert.equal(await window.fetch("/login", options), response);
  assert.equal(received[0], "/login");
  assert.equal(received[1], options, "login must retain method, headers, body and signal");
  assert.equal(pending, 0);

  const request = new Request("https://example.invalid/test", { method: "POST", body: "{}" });
  await window.fetch(request);
  assert.equal(received[0], request, "Request objects must be preserved");
  assert.equal(pending, 0, "busy dialog must close after success");

  await window.fetch("/read");
  assert.equal(received[0], "/read");
  assert.equal(received[1], undefined);

  failure = new Error("Simulated network failure");
  await assert.rejects(window.fetch("/write", options), (error) => error === failure);
  assert.equal(pending, 0, "busy dialog must close after failure");
  console.log(`${file}: fetch preserves POST options, Request objects and errors`);
}

(async () => {
  await verify("Component.js");
  await verify("Component-preload.js");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
