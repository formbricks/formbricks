import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import ReactDOM from "react-dom";

//styles imports in angular.json
interface TextQuestionData extends BlockToolData {
  latexString: string;
}

export default class TextQuestion implements BlockTool {
  label: string;
  placeholder: string;
  api: API;

  static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-align-justify"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>`,
      title: "Text Question",
    };
  }

  constructor({
    data,
  }: {
    api: API;
    config?: ToolConfig;
    data?: TextQuestionData;
  }) {
    this.label = data.label;
    this.placeholder = data.placeholder;
  }

  save(block: HTMLDivElement) {
    return {
      label: (
        block.firstElementChild.firstElementChild
          .firstElementChild as HTMLInputElement
      ).value,
      placeholder: (
        block.firstElementChild.lastElementChild as HTMLInputElement
      ).value,
    };
  }

  renderSettings(): HTMLElement {
    return document.createElement("div");
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    const toolView = (
      <div className="pb-5">
        <div className="font-bold leading-7 text-gray-800 text-md sm:truncate">
          <input
            type="text"
            id="label"
            defaultValue={this.label}
            className="block w-full p-0 border-0 border-transparent ring-0 focus:ring-0"
            placeholder="Your Question"
          />
        </div>
        <input
          type="text"
          className="block w-full mt-1 text-sm text-gray-400 border-gray-300 rounded-md shadow-sm placeholder:text-gray-300"
          placeholder="optional placeholder"
          defaultValue={this.placeholder}
        />
      </div>
    );
    ReactDOM.render(toolView, container);
    return container;
  }
}
