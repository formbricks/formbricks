import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import { EnvelopeIcon } from "@heroicons/react/24/solid";
import ReactDOM from "react-dom";

//styles imports in angular.json
interface EmailQuestionData extends BlockToolData {
  label: string;
  help: string;
  placeholder: string;
  required: boolean;
}

export default class EmailQuestion implements BlockTool {
  settings: { name: string; icon: string }[];
  api: API;
  data: any;
  wrapper: undefined | HTMLElement;

  static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M14.243 5.757a6 6 0 10-.986 9.284 1 1 0 111.087 1.678A8 8 0 1118 10a3 3 0 01-4.8 2.401A4 4 0 1114 10a1 1 0 102 0c0-1.537-.586-3.07-1.757-4.243zM12 10a2 2 0 10-4 0 2 2 0 004 0z" clip-rule="evenodd" />
    </svg>`,
      title: "Email Question",
    };
  }

  constructor({
    data,
  }: {
    api: API;
    config?: ToolConfig;
    data?: EmailQuestionData;
  }) {
    this.wrapper = undefined;
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
      required: data.required !== undefined ? data.required : true,
    };
  }

  save(block: HTMLDivElement) {
    return {
      ...this.data,
      label: (
        block.firstElementChild.firstElementChild
          .firstElementChild as HTMLInputElement
      ).value,
      placeholder: (
        (block.firstElementChild.childNodes[1] as HTMLInputElement)
          .lastElementChild as HTMLInputElement
      ).value,
      help: (block.firstElementChild.lastElementChild as HTMLInputElement)
        .value,
    };
  }

  renderSettings(): HTMLElement {
    const wrapper = document.createElement("div");

    this.settings.forEach((tune) => {
      let button = document.createElement("div");

      button.classList.add("cdx-settings-button");
      button.classList.toggle(
        "cdx-settings-button--active",
        this.data[tune.name]
      );
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
      this.wrapper.childNodes[0].childNodes[0].childNodes[1].textContent = this
        .data.required
        ? "*"
        : "";
    }
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    const toolView = (
      <div className="pb-5">
        <div className="relative font-bold leading-7 text-gray-800 text-md sm:truncate">
          <input
            type="text"
            id="label"
            defaultValue={this.data.label}
            className="w-full p-0 border-0 border-transparent ring-0 focus:ring-0 placeholder:text-gray-300"
            placeholder="Your Question"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-red-500 pointer-events-none">
            *
          </div>
        </div>
        <div className="relative max-w-sm mt-1 rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <EnvelopeIcon
              className="w-5 h-5 text-gray-400"
              aria-hidden="true"
            />
          </div>
          <input
            type="text"
            name="email"
            className="block w-full pl-10 text-gray-300 border-gray-300 rounded-md sm:text-sm"
            defaultValue={this.data.placeholder}
          />
        </div>
        <input
          type="text"
          id="help-text"
          defaultValue={this.data.help}
          className="block w-full max-w-sm p-0 mt-2 text-sm font-light text-gray-500 border-0 border-transparent ring-0 focus:ring-0 placeholder:text-gray-300"
          placeholder="optional help text"
        />
      </div>
    );
    ReactDOM.render(toolView, this.wrapper);
    return this.wrapper;
  }
}
