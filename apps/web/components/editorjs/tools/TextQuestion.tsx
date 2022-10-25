import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import ReactDOM from "react-dom";

import TextQuestionComponent from "./TextQuestionComponent";

export interface TextQuestionData extends BlockToolData {
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
}

export default class TextQuestion implements BlockTool {
  settings: { name: string; icon: string }[];
  api: API;
  data: TextQuestionData;
  nodes: { holder: HTMLElement };
  config: ToolConfig;

  static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"> <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /> </svg>`,
      title: "Text Question",
    };
  }

  constructor({ api, config, data }: { api: API; config?: ToolConfig; data?: TextQuestionData }) {
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
      placeholder: data.placeholder || "",
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

  render(): HTMLElement {
    const rootNode = document.createElement("div");

    this.nodes.holder = rootNode;

    const onDataChange = (newData: TextQuestionData) => {
      this.data = {
        ...newData,
      };
    };

    ReactDOM.render(<TextQuestionComponent onDataChange={onDataChange} data={this.data} />, rootNode);

    return this.nodes.holder;
  }

  save() {
    return this.data;
  }

  /**
   * @private
   * Click on the Settings Button
   * @param {string} tune — tune name from this.settings
   */
  _toggleTune(tune) {
    if (tune === "required") {
      this.data.required = !this.data.required;
    }
  }
}
