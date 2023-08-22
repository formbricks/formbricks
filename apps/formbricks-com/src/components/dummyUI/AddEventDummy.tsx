import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@formbricks/ui";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

const DummyUI: React.FC = () => {
  const eventClasses = [
    { id: "1", name: "View Dashboard" },
    { id: "2", name: "Upgrade to Pro" },
    { id: "3", name: "Cancel Plan" },
  ];

  const [triggers, setTriggers] = useState<string[]>([eventClasses[0].id]);

  const setTriggerEvent = (index: number, eventClassId: string) => {
    setTriggers((prevTriggers) =>
      prevTriggers.map((trigger, idx) => (idx === index ? eventClassId : trigger))
    );
  };

  const addTriggerEvent = () => {
    setTriggers((prevTriggers) => [...prevTriggers, eventClasses[0].id]);
  };

  const removeTriggerEvent = (index: number) => {
    setTriggers((prevTriggers) => prevTriggers.filter((_, idx) => idx !== index));
  };

  return (
    <>
      {triggers.map((triggerEventClassId, idx) => (
        <div className="mt-2" key={idx}>
          <div className="inline-flex items-center">
            <p className="mr-2 w-14 text-right text-sm text-slate-800 dark:text-slate-300">
              {idx === 0 ? "When" : "or"}
            </p>
            <Select
              value={triggerEventClassId}
              onValueChange={(eventClassId) => setTriggerEvent(idx, eventClassId)}>
              <SelectTrigger className="w-[180px] text-slate-800 dark:border-slate-400 dark:bg-slate-700 dark:text-slate-300">
                <SelectValue className="" />
              </SelectTrigger>
              <SelectContent>
                {eventClasses.map((eventClass) => (
                  <SelectItem
                    key={eventClass.id}
                    className="px-0.5 py-1 text-slate-800 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-700"
                    value={eventClass.id}>
                    {eventClass.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={() => removeTriggerEvent(idx)}>
              <TrashIcon className="ml-3 h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      ))}
      <div className="p-3">
        <Button
          variant="secondary"
          className="dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          onClick={() => {
            addTriggerEvent();
          }}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add event
        </Button>
      </div>
    </>
  );
};

export default DummyUI;
