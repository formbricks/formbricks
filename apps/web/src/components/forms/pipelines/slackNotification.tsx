import Link from "next/link";

export const slackNotification = {
  typeId: "slackNotification",
  title: "Slack Notification",
  description: "Get a Slack notification when events happen in your form (e.g. a new submission).",
};

const eventTypes = [
  {
    id: "submissionCreated",
    name: "Submission Created",
    description:
      "Every time a new submission is created in Formbricks (e.g. a new submission or first step in a multi-step form)",
  },
  {
    id: "submissionUpdated",
    name: "Submission Updated",
    description: "Every time a submission is updated, e.g. one step in a multi-step form",
  },
  {
    id: "submissionFinished",
    name: "Submission Finished",
    description: "Every time a submission is finished, e.g. a multi-step form is completed",
  },
];

export function SlackNotificationSettings({ pipeline, setPipeline }) {
  const toggleEvent = (eventId) => {
    const newPipeline = JSON.parse(JSON.stringify(pipeline));
    const eventIdx = newPipeline.events.indexOf(eventId);
    if (eventIdx !== -1) {
      newPipeline.events.splice(eventIdx, 1);
    } else {
      newPipeline.events.push(eventId);
    }
    setPipeline(newPipeline);
  };

  const updateField = (field, value, parent = null) => {
    const newPipeline = JSON.parse(JSON.stringify(pipeline));
    if (parent) {
      newPipeline[parent][field] = value;
    } else {
      newPipeline[field] = value;
    }
    setPipeline(newPipeline);
  };

  return (
    <div className="space-y-8 divide-y divide-slate-200">
      <div>
        <h2 className="text-ui-slate-dark mb-3 text-xl font-bold">Configure Slack Notification</h2>
        <p className="mt-1 text-sm text-slate-500">
          This pipeline uses Slack webhooks. To learn more how to setup these please checkout the{" "}
          <Link href="https://api.slack.com/messaging/webhooks" target="_blank" className="underline">
            Slack Documentation
          </Link>
        </p>

        <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <label htmlFor="label" className="block text-sm font-medium text-slate-700">
              Pipeline Label
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="label"
                id="label"
                placeholder="My Slack Notification Pipeline"
                value={pipeline.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                required
              />
            </div>
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="endpointUrl" className="block text-sm font-medium text-slate-700">
              Endpoint URL
            </label>
            <div className="mt-1">
              <input
                type="url"
                pattern="^https:\/\/(.*)"
                onInvalid={(e: any) =>
                  e.target.setCustomValidity("please provide a valid website address with https")
                }
                onInput={(e: any) => e.target.setCustomValidity("")}
                name="endpointUrl"
                id="endpointUrl"
                placeholder="https://hooks.slack.com/services/ABC123/DEFGH456/IJKLM7890"
                value={pipeline.config.endpointUrl || ""}
                onChange={(e) => updateField("endpointUrl", e.target.value, "config")}
                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                required
              />
            </div>
            <p className="mt-2 text-xs text-slate-500" id="url-description">
              The Webhook URL provided by Slack
            </p>
          </div>
        </div>
      </div>

      <div className="pt-8">
        <div>
          <h3 className="text-lg font-medium leading-6 text-slate-900">Advanced Settings</h3>
          <p className="mt-1 text-sm text-slate-500">Set up this pipeline to fit your needs.</p>
        </div>
        <div className="mt-6">
          <fieldset>
            <legend className="sr-only">Events</legend>
            <div className="text-base font-medium text-slate-900" aria-hidden="true">
              Events
            </div>
            <div className="mt-4 space-y-4">
              {eventTypes.map((eventType) => (
                <div key={eventType.id}>
                  <div className="relative flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id={eventType.id}
                        name={eventType.id}
                        type="checkbox"
                        checked={pipeline.events.includes(eventType.id)}
                        onChange={() => toggleEvent(eventType.id)}
                        className="h-4 w-4 rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor={eventType.id} className="font-medium text-slate-700">
                        {eventType.name}
                      </label>
                      <p className="text-slate-500">{eventType.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  );
}
