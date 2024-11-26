# Formbricks Browser JS Library

[![npm package](https://img.shields.io/npm/v/@formbricks/js?style=flat-square)](https://www.npmjs.com/package/@formbricks/js)
[![MIT License](https://img.shields.io/badge/License-MIT-red.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Please see [Formbricks Docs](https://formbricks.com/docs).
Specifically, [Quickstart/Implementation details](https://formbricks.com/docs/getting-started/quickstart-in-app-survey).

## What is Formbricks

Formbricks is your go-to solution for in-product micro-surveys that will supercharge your product experience! 🚀 For more information please check out [formbricks.com](https://formbricks.com).

## How to use this library

1. Install the Formbricks package inside your project using npm:

```bash
npm install @formbricks/js
```

1. Import Formbricks and initialize the widget in your main component (e.g., App.tsx or App.js):

For `Website` surveys:

```javascript
import formbricks from "@formbricks/js/website";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "your-environment-id",
    apiHost: "https://app.formbricks.com",
  });
}
```

For `App` surveys:

```javascript
import formbricks from "@formbricks/js/app";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "your-environment-id",
    apiHost: "https://app.formbricks.com",
    userId: "REPLACE_WITH_DYNAMIC_ID",
  });
}
```

Replace your-environment-id with your actual environment ID. You can find your environment ID in the **Setup Checklist** in the Formbricks settings. If you are using `App` surveys please make sure to pass a unique user identifier to the Formbricks SDK.

For more detailed guides for different frameworks, check out our [Framework Guides](https://formbricks.com/docs/getting-started/framework-guides).
