import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";

export default function FallbackInput({
  filteredRecallQuestions,
  fallbacks,
  setFallbacks,
  fallbackInputRef,
  addFallback,
}) {
  return (
    <div className="fixed z-30 mt-1 rounded-md border border-slate-300 bg-slate-50 p-3 text-xs">
      <p className="font-medium">Add a placeholder to show if the question gets skipped:</p>
      {filteredRecallQuestions.map((recallQuestion) => (
        <div className="mt-2 flex flex-col">
          <div className="flex items-center">
            <Input
              className="placeholder:text-md h-full bg-white"
              /*    placeholder={`Placeholder for "${recallQuestion!.headline}"`} */
              ref={fallbackInputRef}
              id="fallback"
              value={fallbacks[recallQuestion!.id].replaceAll("nbsp", " ")}
              onChange={(e) => {
                const newFallbacks = { ...fallbacks };
                newFallbacks[recallQuestion!.id] = e.target.value;
                setFallbacks(newFallbacks);
              }}
            />
          </div>
        </div>
      ))}
      <div className="flex w-full justify-end">
        <Button
          className="mt-2 h-full py-2"
          disabled={Object.values(fallbacks).includes("") || Object.entries(fallbacks).length === 0}
          variant="darkCTA"
          onClick={(e) => {
            e.preventDefault();
            addFallback();
          }}>
          Add
        </Button>
      </div>
    </div>
  );
}
