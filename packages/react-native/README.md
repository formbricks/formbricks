# Formbricks React Native SDK

[![npm package](https://img.shields.io/npm/v/@formbricks/react-native?style=flat-square)](https://www.npmjs.com/package/@formbricks/react-native)
[![MIT License](https://img.shields.io/badge/License-MIT-red.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Please see [Formbricks Docs](https://formbricks.com/docs).
Specifically, [Framework Guides](https://formbricks.com/docs/getting-started/framework-guides).

## What is Formbricks

Formbricks is your go-to solution for in-product micro-surveys that will supercharge your product experience! 🚀 For more information please check out [formbricks.com](https://formbricks.com).

## How to use this library

1. Install the Formbricks package inside your project using npm:

```bash
npm install @formbricks/react-native
```

1. Import Formbricks and initialize the widget in your main component (e.g., App.tsx or App.js):

```javascript
import Formbricks, { track } from "@formbricks/react-native";

export default function App() {
  return (
    <View>
      {/* Your app code */}
      <Formbricks appUrl="https://app.formbricks.com" environmentId="your-environment-id" />
    </View>
  );
}
```

Replace your-environment-id with your actual environment ID. You can find your environment ID in the **Connections instructions** in the Formbricks **Configuration** pages.

For more detailed guides for different frameworks, check out our [Framework Guides](https://formbricks.com/docs/getting-started/framework-guides).
