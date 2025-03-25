# Setup

To run the project, open the `android` folder in **Android Studio**. The project contains two modules:

- **app**: A demo application to exercise the SDK.
- **formbricksSDK**: The SDK package.

Before launching the app, update the mandatory variables in `MainActivity`:

```kotlin
val config = FormbricksConfig.Builder("[API_HOST]", "[ENVIRONMENT_ID]")
    .setLoggingEnabled(true)
    .setFragmentManager(supportFragmentManager)
```

Once these values are properly set, the demo app can be launched.  
The app consists of a single view, `FormbricksDemo`. It is a very simple Jetpack Compose view with a single button.  
The button's action should be updated according to the survey actions:

```kotlin
Formbricks.track("click_demo_button")
```

Replace `"click_demo_button"` with the desired action.

---

# Documentation

You can generate developer documentation for the SDK using **Dokka**.  
To do this, navigate to the `android` folder in a `Terminal` window (or open it in Android Studio) and run:

```sh
./gradlew dokkaHtml
```

This will generate the developer documentation in the `formbricksSDK/build/dokka/html` folder.

---

## Unit Tests

The SDK includes a unit test to verify the Manager's functionality. To run it:

1. Open the `FormbricksInstrumentedTest` file.
2. Since the SDK requires a `Context` for initialization, it uses an instrumented test.
3. Click the double arrow next to `class FormbricksInstrumentedTest` to execute the tests.

To generate a coverage report, navigate to the `android` folder in a `Terminal` window (or open it in Android Studio) and run:

```sh
./gradlew createDebugCoverageReport
```
