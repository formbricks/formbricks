import { API, BlockTool, BlockToolData, ToolConfig } from "@editorjs/editorjs";
import ReactDOM from "react-dom";

//styles imports in angular.json
interface PageTransitionData extends BlockToolData {
  submitLabel: string;
}

export default class PageTransition implements BlockTool {
  submitLabel: string;
  placeholder: string;
  api: API;

  /* static get toolbox(): { icon: string; title?: string } {
    return {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /> </svg>`,
      title: "New Page",
    };
  } */

  constructor({
    data,
    api,
  }: {
    api: API;
    config?: ToolConfig;
    data?: PageTransitionData;
  }) {
    this.api = api;
    this.submitLabel = data.submitLabel || "Submit";
  }

  save(block: HTMLDivElement) {
    return {
      submitLabel: (
        block.firstElementChild.firstElementChild
          .firstElementChild as HTMLElement
      ).innerHTML,
    };
  }

  render(): HTMLElement {
    const container = document.createElement("div");
    const toolView = (
      <div className="relative mt-16 mb-8">
        <div className="absolute inline-flex items-center px-4 py-3 text-sm font-medium text-white bg-gray-700 border border-transparent rounded-md shadow-sm left -top-14 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
          <div
            contentEditable
            id="label"
            defaultValue={this.submitLabel}
            className="p-0 bg-transparent border-transparent ring-0 active:ring-0 focus:border-transparent focus:ring-0 focus:outline-none placeholder:text-opacity-5"
          >
            {this.submitLabel}
          </div>
          {/*  <ArrowRightIcon className="w-5 h-5 ml-2 -mr-1" aria-hidden="true" /> */}
        </div>
        <div className="relative my-4">
          <div
            className="absolute inset-0 flex items-center"
            aria-hidden="true"
          >
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-2 text-sm text-gray-500 bg-white">
              Next Page
            </span>
          </div>
        </div>
      </div>
    );
    ReactDOM.render(toolView, container);
    return container;
  }
}
