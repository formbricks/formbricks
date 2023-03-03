import habitat from "preact-habitat";

import css from "./style.css";

import App from "./App";

const _habitat = habitat(App);

interface Config {
  environmentId: string;
  apiHost: string;
  customer?: {
    email: string;
    data: any;
  };
}

const config: Config = { environmentId: null, apiHost: null };

const init = async (config: Config) => {
  /* // add styles
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = css;
    document.head.appendChild(styleElement);
  }
  // add container element
  if (document.getElementById("formbricks__container") === null) {
    const containerElement = document.createElement("div");
    containerElement.id = "formbricks__container";
    document.body.appendChild(containerElement);
  }
  // set config
  if (!organisationId) {
    throw new Error("organisationId is required");
  }
  if (!formbricksUrl) {
    throw new Error("formbricksUrl is required");
  }
  config.organisationId = organisationId;
  config.formbricksUrl = formbricksUrl;
  // check local storage for customer
  const customer = localStorage.getItem("formbricks__customer");
  if (customer) {
    config.customer = JSON.parse(customer);
  }
  // get forms from backend
  const forms = await getForms();
  if (forms && forms.length > 0) {
    setTimeout(() => {
      renderForm(forms[0].id, forms[0].schema);
    }, 1000);
  } */
  console.log("formbricks initialized");
  console.log(config);
};

const identify = (userEmail, userProperties) => {
  const customer = {
    email: userEmail,
    data: userProperties,
  };
  config.customer = customer;
  // save to local storage
  localStorage.setItem("formbricks__customer", JSON.stringify(customer));
};

const reset = () => {
  delete config.customer;
  localStorage.removeItem("formbricks__customer");
};

const renderForm = (formId, schema) => {
  _habitat.render({
    selector: "#formbricks__container",
    clean: true,
    defaultProps: { config, schema, formId },
  });
};

const getForms = async () => {
  const formRes = await fetch(`${config.apiHost}/api/public/${config.environmentId}/forms`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!formRes.ok) {
    console.error("Error fetching forms");
    return;
  }
  const forms = formRes.json();
  return forms;
};

const formbricks = { identify, init, reset, config };

// (window as any).formbricks = formbricks;

export default formbricks;
