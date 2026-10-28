// A minimal MCP Apps host (spec 2026-01-26) for looking at the views without a real chat client.
// It speaks the postMessage JSON-RPC dialect directly: ui/initialize, ui/notifications/initialized,
// tool-input and tool-result pushes, and answers the requests a view can make (tools/call, ui/message,
// ui/open-link, ui/update-model-context, ui/request-display-mode, resources/read, ping). It enforces the
// spec's default CSP on the view document (plus the domains a fixture declares) so a view that needs
// more than it declared fails here the way it would in Claude or ChatGPT.
const params = new URLSearchParams(location.search);
const viewName = params.get("view");
const fixtureName = params.get("fixture") ?? viewName;
const theme = params.get("theme") === "dark" ? "dark" : "light";
const width = Number(params.get("width") ?? 720);

document.getElementById("frame-wrap").style.setProperty("--w", `${width}px`);
if (theme === "dark") {
  document.getElementById("frame-wrap").style.setProperty("--bg", "#0f172a");
}
document.getElementById("label").textContent = `${viewName} / ${fixtureName} / ${theme} / ${width}px`;

const [html, fixture] = await Promise.all([
  fetch(`/views/${viewName}.html`).then((response) => response.text()),
  fetch(`/fixtures/${fixtureName}.json`).then((response) => response.json()),
]);

const hostLog = [];
window.__hostLog = hostLog;
const logEl = document.getElementById("log");
const record = (entry) => {
  hostLog.push(entry);
  logEl.textContent = hostLog.map((item) => JSON.stringify(item)).join("\n");
};

const declared = fixture.csp ?? {};
const join = (values) => (values ?? []).join(" ");
const csp = [
  "default-src 'none'",
  `script-src 'self' 'unsafe-inline' ${join(declared.resourceDomains)}`,
  `style-src 'self' 'unsafe-inline' ${join(declared.resourceDomains)}`,
  `img-src 'self' data: ${join(declared.resourceDomains)}`,
  `media-src 'self' data: ${join(declared.resourceDomains)}`,
  `font-src ${join(declared.resourceDomains) || "'none'"}`,
  `connect-src ${join(declared.connectDomains) || "'none'"}`,
  `frame-src ${join(declared.frameDomains) || "'none'"}`,
  `base-uri ${join(declared.baseUriDomains) || "'self'"}`,
].join("; ");

const iframe = document.getElementById("view");
const withCsp = html.replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
iframe.srcdoc = withCsp;

const send = (message) => iframe.contentWindow.postMessage({ jsonrpc: "2.0", ...message }, "*");
const reply = (id, result) => send({ id, result });
const fail = (id, code, message) => send({ id, error: { code, message } });

const hostContext = {
  theme,
  styles: { variables: {} },
  displayMode: "inline",
  availableDisplayModes: ["inline", "fullscreen"],
  containerDimensions: { width, maxHeight: 900 },
  locale: fixture.locale ?? "en-US",
  timeZone: "UTC",
  platform: "web",
  deviceCapabilities: { touch: false, hover: true },
  toolInfo: { id: "dev-1", tool: { name: fixture.toolName, inputSchema: { type: "object" } } },
};

window.addEventListener("message", async (event) => {
  if (event.source !== iframe.contentWindow) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;

  if (message.method === "ui/initialize") {
    record({ in: message.method });
    reply(message.id, {
      protocolVersion: "2026-01-26",
      hostInfo: { name: "formbricks-dev-host", version: "0.0.0" },
      hostCapabilities: {
        openLinks: {},
        serverTools: {},
        serverResources: {},
        logging: {},
        updateModelContext: { text: {} },
        message: { text: {} },
      },
      hostContext,
    });
    return;
  }

  if (message.method === "ui/notifications/initialized") {
    record({ in: message.method });
    send({ method: "ui/notifications/tool-input", params: { arguments: fixture.input ?? {} } });
    send({ method: "ui/notifications/tool-result", params: fixture.result });
    return;
  }

  if (message.method === "ui/notifications/size-changed") {
    if (typeof message.params?.height === "number") {
      iframe.style.height = `${Math.ceil(message.params.height)}px`;
    }
    return;
  }

  if (message.id === undefined) {
    if (message.method) record({ notification: message.method, params: message.params });
    return;
  }

  record({ request: message.method, params: message.params });

  switch (message.method) {
    case "ping":
      reply(message.id, {});
      return;
    case "tools/call": {
      const name = message.params?.name;
      const entry = fixture.tools?.[name];
      if (entry === undefined) {
        fail(message.id, -32601, `Dev host has no fixture for tool ${name}`);
        return;
      }
      const results = Array.isArray(entry) ? entry : [entry];
      const count = (window.__toolCalls = {
        ...(window.__toolCalls ?? {}),
        [name]: (window.__toolCalls?.[name] ?? 0) + 1,
      })[name];
      reply(message.id, results[Math.min(count, results.length) - 1]);
      return;
    }
    case "resources/read":
      reply(message.id, { contents: [] });
      return;
    case "ui/open-link":
    case "ui/message":
    case "ui/update-model-context":
      reply(message.id, {});
      return;
    case "ui/request-display-mode":
      reply(message.id, { mode: message.params?.mode === "fullscreen" ? "fullscreen" : "inline" });
      return;
    default:
      fail(message.id, -32601, `Unsupported method ${message.method}`);
  }
});
