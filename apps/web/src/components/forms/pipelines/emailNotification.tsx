export const emailNotification = {
  typeId: "emailNotification",
  title: "Email Notification",
  description: "Get email notifications (e.g. for every new submission).",
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

export function EmailNotificationSettings({ pipeline, setPipeline }) {
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
    <div className="space-y-8 divide-y divide-gray-200">
      <div>
        <h2 className="text-ui-gray-dark mb-3 text-xl font-bold">Configure Email notifications</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure Email notifications. To learn more about how email notifications work, please check out
          our docs.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <label htmlFor="label" className="block text-sm font-medium text-gray-700">
              Pipeline Label
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="label"
                id="label"
                placeholder="My Email Notification Pipeline"
                value={pipeline.label || ""}
                onChange={(e) => updateField("label", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                required
              />
            </div>
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1">
              <input
                type="email"
                name="email"
                id="email"
                placeholder="mail@example.com"
                value={pipeline.config.email || ""}
                onChange={(e) => updateField("email", e.target.value, "config")}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                required
              />
            </div>
            <p className="mt-2 text-xs text-gray-500" id="email-description">
              The email address that will receive notifications when the form/page is completed
            </p>
          </div>
        </div>
      </div>

      <div className="pt-8">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">Advanced Settings</h3>
          <p className="mt-1 text-sm text-gray-500">Set up this webhook to fit your needs.</p>
        </div>
        <div className="mt-6">
          <fieldset>
            <legend className="sr-only">Events</legend>
            <div className="text-base font-medium text-gray-900" aria-hidden="true">
              Events
            </div>
            <div className="mt-4 space-y-4">
              {eventTypes.map((eventType) => (
                <div key={eventType.id}>
                  <div className="relative flex items-start">
                    <div className="flex h-5 items-center">
                      <input
                        id={eventType.id}
                        name={eventType.name}
                        type="checkbox"
                        checked={pipeline.events.includes(eventType.id)}
                        onChange={() => toggleEvent(eventType.id)}
                        className="h-4 w-4 rounded-sm border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor={eventType.id} className="font-medium text-gray-700">
                        {eventType.name}
                      </label>
                      <p className="text-gray-500">{eventType.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        {/*  <div className="mt-6">
          <fieldset>
            <legend className="sr-only">Conditions</legend>
            <div className="text-base font-medium text-gray-900" aria-hidden="true">
              Conditions
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-sm border border-gray-100 bg-gray-50 px-2 py-5">
                <p className="flex justify-center text-xs text-gray-600">
                  conditional data piping coming soon
                </p>
              </div>
            </div>
          </fieldset>
        </div> */}
      </div>
    </div>
  );
}
