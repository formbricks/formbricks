import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import { RadioGroup } from "@headlessui/react";
import ReactDOM from "react-dom";
import { classNames } from "../../../lib/utils";

//styles imports in angular.json
interface SingleChoiceQuestionData extends BlockToolData {
  label: string;
  options: string[];
  required: boolean;
}

export default class SingleChoiceQuestion implements BlockTool {
  settings: { name: string; icon: string }[];
  api: API;
  data: any;
  wrapper: undefined | HTMLElement;

  static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="16" height="16" viewBox="0 0 16 16">
      <path fill="#000000" d="M8 0c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zM8 14c-3.314 0-6-2.686-6-6s2.686-6 6-6c3.314 0 6 2.686 6 6s-2.686 6-6 6zM5 8c0-1.657 1.343-3 3-3s3 1.343 3 3c0 1.657-1.343 3-3 3s-3-1.343-3-3z"/>
      </svg>`,
      title: "Single Choice Question",
    };
  }

  constructor({
    data,
  }: {
    api: API;
    config?: ToolConfig;
    data?: SingleChoiceQuestionData;
  }) {
    this.wrapper = undefined;
    this.settings = [
      {
        name: "required",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 512" class="w-3 h-3"><!-- Font Awesome Pro 5.15.4 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) --><path d="M471.99 334.43L336.06 256l135.93-78.43c7.66-4.42 10.28-14.2 5.86-21.86l-32.02-55.43c-4.42-7.65-14.21-10.28-21.87-5.86l-135.93 78.43V16c0-8.84-7.17-16-16.01-16h-64.04c-8.84 0-16.01 7.16-16.01 16v156.86L56.04 94.43c-7.66-4.42-17.45-1.79-21.87 5.86L2.15 155.71c-4.42 7.65-1.8 17.44 5.86 21.86L143.94 256 8.01 334.43c-7.66 4.42-10.28 14.21-5.86 21.86l32.02 55.43c4.42 7.65 14.21 10.27 21.87 5.86l135.93-78.43V496c0 8.84 7.17 16 16.01 16h64.04c8.84 0 16.01-7.16 16.01-16V339.14l135.93 78.43c7.66 4.42 17.45 1.8 21.87-5.86l32.02-55.43c4.42-7.65 1.8-17.43-5.86-21.85z"/></svg>`,
      },
    ];
    this.data = data;
    this.data = {
      label: data.label || "",
      options: data.options || ["Pizza", "Pasta", "Steak"],
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
      /*  options: (block.firstElementChild.lastElementChild as HTMLInputElement)
        .value, */
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
        <div className="mt-2">
          <div className="sr-only">options</div>
          <div className="relative max-w-sm -space-y-px bg-white rounded-md">
            {this.data.options.map((option, optionIdx) => (
              <div
                key={option.name}
                className={classNames(
                  optionIdx === 0 ? "rounded-tl-md rounded-tr-md" : "",
                  optionIdx === this.data.options.length - 1
                    ? "rounded-bl-md rounded-br-md"
                    : "",

                  "border-gray-200",
                  "relative border p-4 flex flex-col cursor-pointer md:pl-4 md:pr-6 focus:outline-none"
                )}
              >
                <>
                  <span className="flex items-center text-sm">
                    <span
                      className={classNames(
                        "bg-white border-gray-300",
                        "h-4 w-4 rounded-full border flex items-center justify-center"
                      )}
                      aria-hidden="true"
                    >
                      <span className="rounded-full bg-white w-1.5 h-1.5" />
                    </span>
                    <span
                      className="w-full ml-3 font-medium text-gray-900 focus:outline-none"
                      contentEditable
                    >
                      {option}
                    </span>
                  </span>
                </>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    ReactDOM.render(toolView, this.wrapper);
    return this.wrapper;
  }
}
