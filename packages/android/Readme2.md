# Setup

To run the project you just have to open the `android` folder in **Android Studio**. The project will contain 2 modules:

- **app**: a demo application to excercise the SDK
- **formbricksSDK**: the SDK package

Before you launch the app, please make sure to update the mandatory variables in the `MainActivity`:
```
val config = FormbricksConfig.Builder("[API_HOST]","[ENVIRONMENT_ID]")  
    .setLoggingEnabled(true)  
    .setFragmentManager(supportFragmentManager)
```
Once they are set to the proper values, the Demo app can be launched.
The app has a single view, the `FormbricksDemo`. It it a very simple Jetpack Compose view with a single button.
The button's action should be updated according to the survey actions:
```
Formbricks.track("click_demo_button")
```
Change `click_demo_button` to the desired action.


# Docs

You can generate developer documentation for the SDK with pressing with `Dokka`.
For this, navigate to the `android` folder in a `Terminal` window (or open it in Android Studio), and type
```
 ./gradlew dokkaHtml
```
and press enter. This will generate the developer documentation to `formbricksSDK/build/dokka/html` folder.

## Unit test
The SDK has a unit test to verify the Manager's functionality. To run it, open the `FormbricksInstrumentedTest` file. We need a `Context` to initialize the SDK, thus, we use instrumented test. Click the double arrow next to the `class FormbricksInstrumentedTest` to execute the tests.

To generate coverage report, navigate to the `android` folder in a `Terminal` window (or open it in Android Studio), and type
```
./gradlew createDebugCoverageReport   
```
