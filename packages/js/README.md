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

```javascript
import formbricks from "@formbricks/js";

if (typeof window !== "undefined") {
  formbricks.setup({
    environmentId: "your-environment-id",
    appUrl: "https://app.formbricks.com",
  });
}
```

Replace your-environment-id with your actual environment ID. You can find your environment ID in the **Setup Checklist** in the Formbricks settings. If you want to use the user identification feature, please check out [our docs for details](https://formbricks.com/docs/app-surveys/user-identification).

For more detailed guides for different frameworks, check out our [Framework Guides](https://formbricks.com/docs/getting-started/framework-guides).
