import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import ReactDOM from "react-dom";

//styles imports in angular.json
interface TimerToolboxData extends BlockToolData {
  timerDuration: string;
}

export default class TimerToolboxOption implements BlockTool {
  settings: { name: string; icon: string }[];
  api: API;
  data: any;
  wrapper: undefined | HTMLElement;

  static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `⏱️`,
      title: "Timer Option",
    };
  }

  constructor({
    data,
  }: {
    api: API;
    config?: ToolConfig;
    data?: TimerToolboxData;
  }) {
    this.wrapper = undefined;
    this.settings = [
      {
        name: "required",
        icon: `⏱️`,
      },
    ];
    this.data = {
      timerDuration: data.timerDuration || "",
    };
  }

  save(block: HTMLDivElement) {  
    return {
      timerDuration: parseFloat((block.firstElementChild.childNodes[1] as HTMLInputElement).value),
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
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    const toolView = (
      <div className="bg-gray-200 pb-5">
        <div className="relative font-bold leading-7 text-gray-800 text-md sm:truncate">
          <label>{"⏱️ Timer (in minutes)"}</label>
        </div>
        <input
          type="text"
          className="block w-full max-w-sm mt-1 text-sm text-gray-400 rounded-md shadow-sm placeholder:text-red-300"
          defaultValue={this.data.timerDuration}
        />
        <label className="text-sm text-gray-400">{"Set to 0 to disable timer option"}</label>
      </div>
    );
    ReactDOM.render(toolView, this.wrapper);
    return this.wrapper;
  }
}
