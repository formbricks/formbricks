import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import ReactDOM from "react-dom";
import NumberQuestionComponent from "./NumberQuestionComponent";

export interface NumberQuestionData extends BlockToolData {
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
}

export default class NumberQuestion implements BlockTool {
  settings: { name: string; icon: string }[];
  api: API;
  data: NumberQuestionData;
  nodes: { holder: HTMLElement };
  config: ToolConfig;

  static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.938l1-4H9.031z" clip-rule="evenodd" />
    </svg>`,
      title: "Number Question",
    };
  }

  constructor({ api, config, data }: { api: API; config?: ToolConfig; data?: NumberQuestionData }) {
    this.api = api;
    this.config = config;

    this.settings = [
      {
        name: "required",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 512" class="w-3 h-3"><!-- Font Awesome Pro 5.15.4 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) --><path d="M471.99 334.43L336.06 256l135.93-78.43c7.66-4.42 10.28-14.2 5.86-21.86l-32.02-55.43c-4.42-7.65-14.21-10.28-21.87-5.86l-135.93 78.43V16c0-8.84-7.17-16-16.01-16h-64.04c-8.84 0-16.01 7.16-16.01 16v156.86L56.04 94.43c-7.66-4.42-17.45-1.79-21.87 5.86L2.15 155.71c-4.42 7.65-1.8 17.44 5.86 21.86L143.94 256 8.01 334.43c-7.66 4.42-10.28 14.21-5.86 21.86l32.02 55.43c4.42 7.65 14.21 10.27 21.87 5.86l135.93-78.43V496c0 8.84 7.17 16 16.01 16h64.04c8.84 0 16.01-7.16 16.01-16V339.14l135.93 78.43c7.66 4.42 17.45 1.8 21.87-5.86l32.02-55.43c4.42-7.65 1.8-17.43-5.86-21.85z"/></svg>`,
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

  // save(block: HTMLDivElement) {
  //   return {
  //     ...this.data,
  //     label: (block.firstElementChild.firstElementChild.firstElementChild as HTMLInputElement).value,
  //     placeholder: (block.firstElementChild.childNodes[1] as HTMLInputElement).value,
  //     help: (block.firstElementChild.lastElementChild as HTMLInputElement).value,
  //   };
  // }

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

    const onDataChange = (newData: NumberQuestionData) => {
      this.data = {
        ...newData,
      };
    };

    ReactDOM.render(<NumberQuestionComponent onDataChange={onDataChange} data={this.data} />, rootNode);

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
  _toggleTune(tune: string) {
    if (tune === "required") {
      this.data.required = !this.data.required;
    }
  }
}
