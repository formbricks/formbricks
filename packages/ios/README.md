# Setup

To run the project, open `Formbricks.xcworkspace` in **Xcode**. The workspace contains two projects:

- **FormbricksSDK**: The SDK package.
- **Demo**: A demo application to exercise the SDK.

Before launching the `Demo` app, update the mandatory variables in `AppDelegate`:

```swift
let config = FormbricksConfig.Builder(appUrl: "[APP_URL]", environmentId: "[ENVIRONMENT_ID]")
    .setLogLevel(.debug)
    .build()
```

Once these values are properly set, the demo app can be launched.  
The demo app consists of a single view, `ContentView`. It is a SwiftUI view with a single button.  
The button's action should be updated according to the survey actions:

```swift
Formbricks.track("click_demo_button")
```

Replace `"click_demo_button"` with the desired action.

---

# Swift Documentation

You can generate developer documentation for the SDK by pressing **CTRL + Shift + Command + O** on macOS or by selecting **Product → Build Documentation** in Xcode.

---

## Unit Tests

The SDK includes a unit test to verify the Manager's functionality. To run it:

1. Select the `Test Navigator` tab in Xcode.
2. Run the `testFormbricks()` method.

The coverage report can be found in the `Report Navigator` tab.
