export function inject({ config, posthog }) {
  console.log(posthog?.sessionManager?.session);
  const shadow = createShadow();
  const formbricksScript = document.createElement("script");
  formbricksScript.type = "text/javascript";
  formbricksScript.async = true;
  formbricksScript.src = "https://unpkg.com/@formbricks/js@^0.1.4/dist/index.umd.js";

  shadow.appendChild(formbricksScript);

  formbricksScript.onload = () => {
    console.log("initializing");
    setTimeout(() => {
      window.formbricks = window.js;
      window.formbricks.init({
        environmentId: config.environmentId,
        apiHost: config.formbricksHost,
        logLevel: "debug",
      });
    }, 500);
  };
}

function createShadow(): ShadowRoot {
  const div = document.createElement("div");
  const shadow = div.attachShadow({ mode: "open" });
  document.body.appendChild(div);
  return shadow;
}
