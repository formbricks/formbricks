const eventTypes = [
  {
    id: "FORM_OPENED",
    name: "Ouverture des formulaires",
    description: "chaque fois qu'un candidat ouvre un formulaire",
  },
  {
    id: "PAGE_SUBMISSION",
    name: "Soumission d'une page du formulaire",
    description: "chaque fois q'un candidat soumet une étape",
  },
];

export function AirtableSettings({ pipeline, setPipeline }) {
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
    <div className='space-y-8 divide-y divide-gray-200'>
      <div>
        <h2 className='mb-3 text-xl font-bold text-ui-gray-dark'>
          Configurer l&rsquo;intégration
        </h2>
        <p className='mt-1 text-sm text-gray-500'>
          Configurez votre intégration à AirTable.. Pour en savoir plus sur le
          fonctionnement des intégrations, veuillez consultez notre
          documentation.
        </p>
        <div className='grid grid-cols-1 mt-6 gap-y-6 gap-x-4 sm:grid-cols-6'>
          <div className='sm:col-span-4'>
            <label
              htmlFor='name'
              className='block text-sm font-medium text-gray-700'
            >
              Nom du pipeline
            </label>
            <div className='mt-1'>
              <input
                type='text'
                name='name'
                id='name'
                value={pipeline.name || ""}
                onChange={(e) => updateField("name", e.target.value)}
                className='block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm'
                required
              />
            </div>
          </div>
          <div className='sm:col-span-4'>
            <label
              htmlFor='endpointUrl'
              className='block text-sm font-medium text-gray-700'
            >
              Endpoint URL
            </label>
            <div className='mt-1'>
              <input
                type='url'
                pattern='^https:\/\/(.*)'
                onInvalid={(e: any) =>
                  e.target.setCustomValidity(
                    "please provide a valid website address with https"
                  )
                }
                onInput={(e: any) => e.target.setCustomValidity("")}
                name='endpointUrl'
                id='endpointUrl'
                value={pipeline.data.endpointUrl || ""}
                onChange={(e) =>
                  updateField("endpointUrl", e.target.value, "data")
                }
                className='block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm'
                required
              />
            </div>
            <p className='mt-2 text-xs text-gray-500' id='email-description'>
              L&rsquo;URL de votre serveur vers lequel les données doivent être
              envoyées (https obligatoire).
            </p>
          </div>
        </div>
      </div>
      <div className='pt-8'>
        <div>
          <h3 className='text-lg font-medium leading-6 text-gray-900'>
            Paramètres avancés
          </h3>
          <p className='mt-1 text-sm text-gray-500'>
            Configurez ceette itégration en fonction de vos besoins.
          </p>
        </div>
        <div className='mt-6'>
          <fieldset>
            <legend className='sr-only'>Events</legend>
            <div
              className='text-base font-medium text-gray-900'
              aria-hidden='true'
            >
              Événements
            </div>
            <div className='mt-4 space-y-4'>
              {eventTypes.map((eventType) => (
                <div key={eventType.id}>
                  <div className='relative flex items-start'>
                    <div className='flex items-center h-5'>
                      <input
                        id='comments'
                        name='comments'
                        type='checkbox'
                        checked={pipeline.events.includes(eventType.id)}
                        onChange={() => toggleEvent(eventType.id)}
                        className='w-4 h-4 text-red-600 border-gray-300 rounded-sm focus:ring-red-500'
                      />
                    </div>
                    <div className='ml-3 text-sm'>
                      <label
                        htmlFor='comments'
                        className='font-medium text-gray-700'
                      >
                        {eventType.name}
                      </label>
                      <p className='text-gray-500'>{eventType.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        {/* <div className="mt-6">
          <fieldset>
            <legend className="sr-only">Conditions</legend>
            <div
              className="text-base font-medium text-gray-900"
              aria-hidden="true"
            >
              Conditions
            </div>
            <div className="mt-4 space-y-4">
              <div className="px-2 py-5 border border-gray-100 rounded-sm bg-gray-50">
                <p className="flex justify-center text-xs text-gray-600">
                  Bientôt disponible
                </p>
              </div>
            </div>
          </fieldset>
        </div> */}
      </div>
    </div>
  );
}
