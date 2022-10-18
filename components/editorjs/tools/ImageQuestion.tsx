import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import { PhoneIcon, PhotoIcon } from "@heroicons/react/24/outline";
import ImageTool from "@editorjs/image";
import ReactDOM from "react-dom";

interface ImageQuestionData extends BlockToolData {
    label: string;
    help: string;
    src: string;
    required: boolean;
  }
  export default class PhoneQuestion implements BlockTool {
    settings: { name: string; icon: string }[];
    api: API;
    data: any;
    wrapper: undefined | HTMLElement;
  
    static get toolbox(): { icon: string; title?: string } {
      return {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
      `,
        title: "Image Question",
      };
    }
  
    constructor({
      data,
    }: {
      api: API;
      config?: ToolConfig;
      data?: ImageQuestionData;
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
        src: data.src || "",
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
        src: (
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
              className="w-full p-0 border-0 border-transparent ring-0 focus:ring-0 placeholder:text-gray-300 hidden"
              placeholder="Your Question"
              
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-red-500 pointer-events-none">
              *
            </div>
          </div>
          <div className="relative max-w-sm mt-1 rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <PhotoIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="file"
              name="image"
              className="block w-full pl-10 text-gray-300 border-gray-300 rounded-md sm:text-sm"
              defaultValue={this.data.src}
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
  