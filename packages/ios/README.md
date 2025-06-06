# Setup

To run the project, open `Formbricks.xcworkspace` in **Xcode**. The workspace contains two projects:

- **FormbricksSDK**: The SDK package.
- **Demo**: A demo application to exercise the SDK.

Before launching the `Demo` app, update the mandatory variables in `SetupView`:

```swift
let config = FormbricksConfig.Builder(appUrl: "[APP_URL]", environmentId: "[ENVIRONMENT_ID]")
    .setLogLevel(.debug)
    .build()
```

Once these values are properly set, launch the demo app. The demo app uses a single view, `SetupView`, as the initial screen. In this view, tap the **Setup Formbricks SDK** button to initialize the SDK.

Once setup is complete, you can use the **Call Formbricks.track** button to trigger your survey and the **Call Formbricks.cleanup** button to reset the SDK and return to the setup screen.

---

# Swift Documentation

You can generate developer documentation for the SDK by pressing **Shift + Command + Option + D** on macOS or by selecting **Product → Build Documentation** in Xcode.

---

## Unit Tests

The SDK includes unit tests to verify the functionality of various components. To run them:

1. Select the `Test Navigator` tab in Xcode.
2. Run the desired test methods.

The coverage report can be found in the `Report Navigator` tab.
