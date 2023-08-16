import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu"


export default function SpreadsheetSelect() {

  return (
    <div className="flex flex-col">
      <h2 className="text-center text-2xl font-semibold my-2">Select a Spreadsheet</h2>
      <p className="text-center">Select a Spreadsheet to link with selected survey</p>
      <div className="mt-4">
        <div className="rounded-lg bg-white p-6 shadow w-3/4 mx-auto">
          <div className="flex flex-col">
            <p className="font-medium">Choose an option</p>
            <span className="flex items-center mt-4">
              <input
                type="radio"
                id="newSpreadhseet"
                name="newSpreadhseet"
                value="newSpreadhseet"
                className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
              />
              <span className="ml-3 ">
                Create a new spreadsheet
              </span>
            </span>
            <span className="flex items-center mt-4">
              <input
                type="radio"
                id="newSpreadhseet"
                name="newSpreadhseet"
                value="newSpreadhseet"
                className="h-4 w-4 border border-gray-300 focus:ring-0 focus:ring-offset-0"
              />
              <span className="ml-3">
                Use an existing spreadsheet
              </span>
            </span>
          </div>
          <div>
            <div className="mt-6">
              <p>Select Spreadsheet</p>
              <DropdownMenu
                onOpenChange={(value) => {
                  console.log(value)
                }}>
                <DropdownMenuTrigger asChild className="focus:bg-muted cursor-pointer outline-none">
                  <div className="min-w-auto h-auto rounded-md border bg-white p-3 sm:flex sm:min-w-[11rem] sm:px-6 sm:py-3">
                    <div className="hidden w-full items-center justify-between sm:flex">
                      <span className="text-sm text-slate-700">Download</span>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-full" >
                  <DropdownMenuItem
                    className="hover:ring-0 bg-white p-2 w-full"
                    onClick={() => {
                      console.log("hello")
                    }}>
                    <p className="text-slate-700">All responses (CSV)</p>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="hover:ring-0 bg-white p-2 w-full"
                    onClick={() => {
                      console.log("bye")
                    }}>
                    <p className="text-slate-700">Current selection (CSV)</p>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
