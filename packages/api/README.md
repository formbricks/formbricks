# @formbricks/api - API Wrapper for Formbricks

## Installation

```bash
npm install @formbricks/api
```

## Usage

<details>
<summary>Create API Client</summary>

```ts
import { FormbricksAPI, EnvironmentId } from "@formbricks/api";

const api = new FormbricksAPI({
  apiHost: "http://localhost:3000",
  environmentId: "clgwh8maj0005n2f66pwzev3r" as EnvironmentId,
});
```

</details>

> **Note**
> All of the following methods return a `Result` from the `@formbricks/errors` package.

<details>
<summary>Create a new response</summary>

```ts
const response = await api.createResponse({
  surveyId: "......" as SurveyId,
  personId: "......" as PersonId,
  data: {
    questionId: "response",
  },
});
```

</details>

<details>
<summary>Update an existing response</summary>

```ts
const response = await api.updateResponse({
  responseId: "......" as ResponseId, // If you pass response.value.id from createResponse, you dont need 'as ResponseId'
  data: {
    questionId: "response",
  },
});
```

</details>
