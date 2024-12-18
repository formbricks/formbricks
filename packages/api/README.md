# @formbricks/api - API Wrapper for Formbricks

This is the official API wrapper for Formbricks. It is used to interact with the Formbricks API. To know more about Formbricks, visit [Formbricks.com](https://formbricks.com).

The direct API documentation can be found in our official docs [here](https://formbricks.com/docs/api/client/overview). To interact with the Formbricks API, you need to have an environment ID. You can get it from the Formbricks dashboard at [app.formbricks.com](https://app.formbricks.com).

## Installation

```bash
npm install @formbricks/api
```

## Usage

### Init

```ts
import { FormbricksAPI } from "@formbricks/api";

const api = new FormbricksAPI({
  apiHost: `https://app.formbricks.com`, // If you have self-hosted Formbricks, change this to your self hosted instance's URL
  environmentId: "<environment-id>", // Replace this with your Formbricks environment ID
});
```

The API client is now ready to be used across your project. It can be used to interact with the following models:

### Display

- Create a Display

  ```ts
  await api.client.display.create({
    surveyId: "<your-survey-id>", // required
    userId: "<your-user-id>", // optional
    responseId: "<your-response-id>", // optional
  });
  ```

### Response

- Create a Response

  ```ts
  await api.client.response.create({
    surveyId: "<your-survey-id>", // required
    finished: boolean, // required
    data: {
      questionId: "<answer-to-this-question-in-string>",
      anotherQuestionId: 123, // answer to this question in number
      yetAnotherQuestionId: ["option1", "option2"], // answer to this question in array,
    }, // required

    userId: "<your-user-id>", // optional
    singleUseId: "<your-single-use-id>", // optional
    ttc: {
      questionId: 123, // optional
    }, // optional
    meta: {
      source: "<your-source>", // optional
      url: "<your-url>", // optional
      userAgent: {
        browser: "<your-browser>", // optional
        device: "<your-device>", // optional
        os: "<your-os>", // optional
      },
      country: "<your-country>", // optional
    }, // optional
  });
  ```

- Update a Response

  ```ts
  await api.client.response.update({
    responseId: "<your-response-id>", // required
    finished: boolean, // required
    data: {
      questionId: "<answer-to-this-question-in-string>",
      anotherQuestionId: 123, // answer to this question in number
      yetAnotherQuestionId: ["option1", "option2"], // answer to this question in array,
    }, // required
    ttc: {
      questionId: 123, // optional
    }, // optional
  });
  ```

### Contact Attributes

- Update contact attributes

  ```ts
  await api.client.attribute.update({
    userId: "<your-user-id>", // required
    attributes: {
      plan: "Pro",
    }, // required
  });
  ```

### Storage

- Upload a file

  ```ts
  await api.client.storage.uploadFile(
    file: File, // required (of interface File of the browser's File API)
    {
      allowedFileTypes: ["file-type-allowed", "for-example", "image/jpeg"], // optional
      surveyId: "<your-survey-id>", // optional

    } // optional
  );
  ```

If you have any questions or need help, feel free to reach out to us on [Github Discussions](https://github.com/formbricks/formbricks/discussions)
