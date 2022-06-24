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
      icon: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M18.1 15.3C18 15.4 17.8 15.5 17.7 15.6L15.3 16L17 19.6C17.2 20 17 20.4 16.6 20.6L13.8 21.9C13.7 22 13.6 22 13.5 22C13.2 22 12.9 21.8 12.8 21.6L11.2 18L9.3 19.5C9.2 19.6 9 19.7 8.8 19.7C8.4 19.7 8 19.4 8 18.9V7.5C8 7 8.3 6.7 8.8 6.7C9 6.7 9.2 6.8 9.3 6.9L18 14.3C18.3 14.5 18.4 15 18.1 15.3M6 12H4V4H20V12H18.4L20.6 13.9C21.4 13.6 21.9 12.9 21.9 12V4C21.9 2.9 21 2 19.9 2H4C2.9 2 2 2.9 2 4V12C2 13.1 2.9 14 4 14H6V12Z" />`,
      title: "Submit Button",
    };
  }

  constructor({
    data,
  }: {
    api: API;
    config?: ToolConfig;
    data?: TextQuestionData;
  }) {
    this.label = data.label || "Submit";
    this.placeholder = data.placeholder;
  }

  save(block: HTMLDivElement) {
    return {
      label: (block.firstElementChild.firstElementChild as HTMLInputElement)
        .innerHTML,
    };
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    const toolView = (
      <div className="inline-flex items-center px-4 py-3 text-sm font-medium text-white bg-gray-700 border border-transparent rounded-md shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
        <div
          contentEditable
          id="label"
          defaultValue={this.label}
          className="p-0 bg-transparent border-transparent ring-0 active:ring-0 focus:border-transparent focus:ring-0 focus:outline-none"
        >
          {this.label}
        </div>
        {/*  <ArrowRightIcon className="w-5 h-5 ml-2 -mr-1" aria-hidden="true" /> */}
      </div>
    );
    ReactDOM.render(toolView, container);
    return container;
  }
}
