import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";

interface IAddVariablesDropdown {
  addVariable: (variable: string) => void;
  isTextEditor?: boolean;
  variables: string[];
}

export const AddVariablesDropdown: React.FC<IAddVariablesDropdown> = (props) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:bg-muted pt-[6px]">
        <div className="items-center">
          {props.isTextEditor ? (
            <>
              <div className="hidden sm:flex">
                add_variable
                <ChevronDownIcon className="ml-1 mt-[2px] h-4 w-4" />
              </div>
              <div className="block sm:hidden">+</div>
            </>
          ) : (
            <div className="flex">
              add_variable
              <ChevronDownIcon className="ml-1 mt-[2px] h-4 w-4" />
            </div>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="pb-1 pt-4">
          <div className="text-subtle mb-2 px-4 text-left text-xs">
            {"add_dynamic_variables".toLocaleUpperCase()}
          </div>
          <div className="h-64 overflow-scroll md:h-80">
            {props.variables.map((variable) => (
              <DropdownMenuItem key={variable}>
                <button
                  key={variable}
                  type="button"
                  className="w-full px-4 py-2"
                  onClick={() => props.addVariable(`${variable}_variable`)}>
                  <div className="sm:grid sm:grid-cols-2">
                    <div className="mr-3 text-left md:col-span-1">
                      {`{${`${variable}_variable`.toUpperCase().replace(/ /g, "_")}}`}
                    </div>
                    <div className="text-default hidden text-left sm:col-span-1 sm:flex">
                      {`${variable}_info`}
                    </div>
                  </div>
                </button>
              </DropdownMenuItem>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
