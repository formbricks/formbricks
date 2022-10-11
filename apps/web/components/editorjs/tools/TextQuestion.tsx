import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import ReactDOM from "react-dom";

//styles imports in angular.json
interface TextQuestionData extends BlockToolData {
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
}

export default class TextQuestion implements BlockTool {
  settings: { name: string; icon: string }[];
  api: API;
  data: any;
  wrapper: undefined | HTMLElement;

  static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"> <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /> </svg>`,
      title: "Text Question",
    };
  }

  constructor({ data }: { api: API; config?: ToolConfig; data?: TextQuestionData }) {
    this.wrapper = undefined;
    this.settings = [
      {
        name: "required",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"> <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" /> </svg>`,
      },
    ];
    this.data = {
      label: data.label || "",
      help: data.help || "",
      placeholder: data.placeholder || "",
      required: data.required !== undefined ? data.required : true,
    };
  }

  save(block: HTMLDivElement) {
    return {
      ...this.data,
      label: (block.firstElementChild.firstElementChild.firstElementChild as HTMLInputElement).value,
      placeholder: (block.firstElementChild.childNodes[1] as HTMLInputElement).value,
      help: (block.firstElementChild.lastElementChild as HTMLInputElement).value,
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
  _toggleTune(tune) {
    this.wrapper.classList.toggle(tune.name, !!this.data[tune.name]);

    if (tune === "required") {
      this.data.required = !this.data.required;
      this.wrapper.childNodes[0].childNodes[0].childNodes[1].textContent = this.data.required ? "*" : "";
    }
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    const toolView = (
      <div className="pb-5">
        <div className="text-md relative font-bold leading-7 text-gray-800 sm:truncate">
          <input
            type="text"
            id="label"
            defaultValue={this.data.label}
            className="w-full border-0 border-transparent p-0 ring-0 placeholder:text-gray-300 focus:ring-0"
            placeholder="Your Question"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-red-500">
            *
          </div>
        </div>
        <input
          type="text"
          className="mt-1 block w-full max-w-sm rounded-md border-gray-300 text-sm text-gray-400 shadow-sm placeholder:text-gray-300"
          placeholder="optional placeholder"
          defaultValue={this.data.placeholder}
        />
        <input
          type="text"
          id="help-text"
          defaultValue={this.data.help}
          className="mt-2 block w-full max-w-sm border-0 border-transparent p-0 text-sm font-light text-gray-500 ring-0 placeholder:text-gray-300 focus:ring-0"
          placeholder="optional help text"
        />
      </div>
    );
    ReactDOM.render(toolView, this.wrapper);
    return this.wrapper;
  }
}
