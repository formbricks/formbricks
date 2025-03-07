# Setup

To run the project you just have to open the `Formbricks.xcworkspace` in Xcode. The workspace will contain 2 projects:

- **FormbricksSDK**: the SDK package
- **Demo**: a demo application to excercise the SDK

Before you launch the `Demo` app, please make sure to update the mandatory variables in the `AppDelegate`:
```
let config = FormbricksConfig.Builder(appUrl: "[appUrl]", environmentId: "[environmentId]")

.setLogLevel(.debug)

.build()
```
Once they are set to the proper values, the Demo app can be launched.
The Demo app has a single view, the `ContentView`. It is a SwiftUI view with a single Button.
The button's action should be updated according to the survey actions:
```
Formbricks.track("click_demo_button")
```
Change `click_demo_button` to the desired action.


# Swift Docs

You can generate developer documentation for the SDK with pressing `CTRL + Shift + Command + O` in OSX, or generate it by clicking `Product -> Build Documentation` in Xcode.

## Unit test
The SDK has a unit test to verify the Manager's functionality. To run it, select the `Test navigator` tab in Xcode and run the `testFormbricks()` method. The coverage can be found in the `Report navigator` tab.
