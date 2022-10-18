import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import ReactDOM from "react-dom";

import EmailQuestionComponent from "./EmailQuestionComponent";

export interface EmailQuestionData extends BlockToolData {
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
}

export default class EmailQuestion implements BlockTool {
  settings: { name: string; icon: string }[];
  api: API;
  data: EmailQuestionData;
  nodes: { holder: HTMLElement };
  config: ToolConfig;

  static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M14.243 5.757a6 6 0 10-.986 9.284 1 1 0 111.087 1.678A8 8 0 1118 10a3 3 0 01-4.8 2.401A4 4 0 1114 10a1 1 0 102 0c0-1.537-.586-3.07-1.757-4.243zM12 10a2 2 0 10-4 0 2 2 0 004 0z" clip-rule="evenodd" />
    </svg>`,
      title: "Email Question",
    };
  }

  constructor({ api, config, data }: { api: API; config?: ToolConfig; data?: EmailQuestionData }) {
    this.api = api;
    this.config = config;

    this.settings = [
      {
        name: "required",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 512" class="w-3 h-3"><path d="M471.99 334.43L336.06 256l135.93-78.43c7.66-4.42 10.28-14.2 5.86-21.86l-32.02-55.43c-4.42-7.65-14.21-10.28-21.87-5.86l-135.93 78.43V16c0-8.84-7.17-16-16.01-16h-64.04c-8.84 0-16.01 7.16-16.01 16v156.86L56.04 94.43c-7.66-4.42-17.45-1.79-21.87 5.86L2.15 155.71c-4.42 7.65-1.8 17.44 5.86 21.86L143.94 256 8.01 334.43c-7.66 4.42-10.28 14.21-5.86 21.86l32.02 55.43c4.42 7.65 14.21 10.27 21.87 5.86l135.93-78.43V496c0 8.84 7.17 16 16.01 16h64.04c8.84 0 16.01-7.16 16.01-16V339.14l135.93 78.43c7.66 4.42 17.45 1.8 21.87-5.86l32.02-55.43c4.42-7.65 1.8-17.43-5.86-21.85z"/></svg>`,
      },
    ];

    this.data = {
      label: data.label || "",
      help: data.help || "",
      placeholder: data.placeholder || "your email",
      required: data.required || false,
    };

    this.nodes = {
      holder: null,
    };
  }

  renderSettings(): HTMLElement {
    const wrapper = document.createElement("div");

    this.settings.forEach((tune) => {
      let button = document.createElement("div");

      button.classList.add("cdx-settings-button");
      button.classList.toggle("cdx-settings-button--active", this.data[tune.name]);
      button.innerHTML = tune.icon;
      wrapper.appendChild(button);

      button.addEventListener("click", () => {
        this._toggleTune(tune.name);
        button.classList.toggle("cdx-settings-button--active");
      });
    });

    return wrapper;
  }

  /**
   * @private
   * Click on the Settings Button
   * @param {string} tune — tune name from this.settings
   */
  _toggleTune(tune: string) {
    if (tune === "required") {
      this.data.required = !this.data.required;
    }
  }

  render(): HTMLElement {
    const rootNode = document.createElement("div");

    this.nodes.holder = rootNode;

    const onDataChange = (newData: EmailQuestionData) => {
      this.data = {
        ...newData,
      };
    };

    ReactDOM.render(<EmailQuestionComponent onDataChange={onDataChange} data={this.data} />, rootNode);

    return this.nodes.holder;
  }

  save() {
    return this.data;
  }
}
