# Identify users - Docs

Linking events to specific users enables you to build a full picture of how they're using your product across different sessions, devices, and platforms.

This is straightforward to do when [capturing backend events](/docs/product-analytics/capture-events?tab=Node.js.md), as you associate events to a specific user using a `distinct_id`, which is a required argument.

However, in the frontend of a [web](/docs/libraries/js/features#capturing-events.md) or [mobile app](/docs/libraries/ios#capturing-events.md), a `distinct_id` is not a required argument — PostHog's SDKs will generate an anonymous `distinct_id` for you automatically and you can capture events anonymously, provided you use the appropriate [configuration](/docs/libraries/js/features#capturing-anonymous-events.md).

To link events to specific users, call `identify`:

PostHog AI

### Web

```javascript
posthog.identify(
  'distinct_id',  // Replace 'distinct_id' with your user's unique identifier
  { email: 'max@hedgehogmail.com', name: 'Max Hedgehog' } // optional: set additional person properties
);
```

### Android

```kotlin
PostHog.identify(
    distinctId = distinctID, // Replace 'distinctID' with your user's unique identifier
    // optional: set additional person properties
    userProperties = mapOf(
        "name" to "Max Hedgehog",
        "email" to "max@hedgehogmail.com"
    )
)
```

### iOS

```swift
PostHogSDK.shared.identify("distinct_id", // Replace "distinct_id" with your user's unique identifier
                           userProperties: ["name": "Max Hedgehog", "email": "max@hedgehogmail.com"]) // optional: set additional person properties
```

### React Native

```jsx
posthog.identify('distinct_id', { // Replace "distinct_id" with your user's unique identifier
    email: 'max@hedgehogmail.com', // optional: set additional person properties
    name: 'Max Hedgehog'
})
```

### Dart

```dart
await Posthog().identify(
  userId: 'distinct_id', // Replace "distinct_id" with your user's unique identifier
  userProperties: {
    email: "max@hedgehogmail.com", // optional: set additional person properties
    name: "Max Hedgehog"
});
```

Events captured after calling `identify` are identified events and this creates a person profile if one doesn't exist already.

Due to the cost of processing them, anonymous events can be up to 4x cheaper than identified events, so it's recommended you only capture identified events when needed.

## How identify works

When a user starts browsing your website or app, PostHog automatically assigns them an **anonymous ID**, which is stored locally.

Provided you've [configured persistence](/docs/libraries/js/persistence.md) to use cookies or `localStorage`, this enables us to track anonymous users – even across different sessions.

By calling `identify` with a `distinct_id` of your choice (usually the user's ID in your database, or their email), you link the anonymous ID and distinct ID together.

Thus, all past and future events made with that anonymous ID are now associated with the distinct ID.

This enables you to do things like associate events with a user from before they log in for the first time, or associate their events across different devices or platforms.

Using identify in the backend

Although you can call `identify` using our backend SDKs, it is used most in frontends. This is because there is no concept of anonymous sessions in the backend SDKs, so calling `identify` only updates person profiles.

## Best practices when using `identify`

### 1\. Call `identify` as soon as you're able to

In your frontend, you should call `identify` as soon as you're able to.

Typically, this is every time your **app loads** for the first time, and directly after your **users log in**.

This ensures that events sent during your users' sessions are correctly associated with them.

You only need to call `identify` once per session, and you should avoid calling it multiple times unnecessarily.

If you call `identify` multiple times with the same data without reloading the page in between, PostHog will ignore the subsequent calls.

### 2\. Use unique strings for distinct IDs

If two users have the same distinct ID, their data is merged and they are considered one user in PostHog. Two common ways this can happen are:

-   Your logic for generating IDs does not generate sufficiently strong IDs and you can end up with a clash where 2 users have the same ID.
-   There's a bug, typo, or mistake in your code leading to most or all users being identified with generic IDs like `null`, `true`, or `distinctId`.

PostHog also has built-in protections to stop the most common distinct ID mistakes.

### 3\. Reset after logout

If a user logs out on your frontend, you should call `reset()` to unlink any future events made on that device with that user.

This is important if your users are sharing a computer, as otherwise all of those users are grouped together into a single user due to shared cookies between sessions.

**We strongly recommend you call `reset` on logout even if you don't expect users to share a computer.**

You can do that like so:

PostHog AI

### Web

```javascript
posthog.reset()
```

### iOS

```swift
PostHogSDK.shared.reset()
```

### Android

```kotlin
PostHog.reset()
```

### React Native

```jsx
posthog.reset()
```

### Dart

```dart
Posthog().reset()
```

If you *also* want to reset the `device_id` so that the device will be considered a new device in future events, you can pass `true` as an argument:

Web

PostHog AI

```javascript
posthog.reset(true)
```

### 4\. Person profiles and properties

You'll notice that one of the parameters in the `identify` method is a `properties` object.

This enables you to set [person properties](/docs/product-analytics/person-properties.md).

Whenever possible, we recommend passing in all person properties you have available each time you call identify, as this ensures their person profile on PostHog is up to date.

Person properties can also be set being adding a `$set` property to a event `capture` call.

See our [person properties docs](/docs/product-analytics/person-properties.md) for more details on how to work with them and best practices.

### 5\. Use deep links between platforms

We recommend you call `identify` [as soon as you're able](#1-call-identify-as-soon-as-youre-able), typically when a user signs up or logs in.

This doesn't work if one or both platforms are unauthenticated. Some examples of such cases are:

-   Onboarding and signup flows before authentication.
-   Unauthenticated web pages redirecting to authenticated mobile apps.
-   Authenticated web apps prompting an app download.

In these cases, you can use a [deep link](https://developer.android.com/training/app-links/deep-linking) on Android and [universal links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app) on iOS to identify users.

1.  Use `posthog.get_distinct_id()` to get the current distinct ID. Even if you cannot call identify because the user is unauthenticated, this will return an anonymous distinct ID generated by PostHog.
2.  Add the distinct ID to the deep link as query parameters, along with other properties like UTM parameters.
3.  When the user is redirected to the app, parse the deep link and handle the following cases:

-   The user is already authenticated on the mobile app. In this case, call [`posthog.alias()`](/docs/libraries/js/features#alias.md) with the distinct ID from the web. This associates the two distinct IDs as a single person.
-   The user is unauthenticated. In this case, call [`posthog.identify()`](/docs/libraries/js/features#identifying-users.md) with the distinct ID from the web. Events will be associated with this distinct ID.

As long as you associate the distinct IDs with `posthog.identify()` or `posthog.alias()`, you can track events generated across platforms.

## Further reading

-   [Identifying users docs](/docs/product-analytics/identify.md)
-   [How person processing works](/docs/how-posthog-works/ingestion-pipeline#2-person-processing.md)
-   [An introductory guide to identifying users in PostHog](/tutorials/identifying-users-guide.md)

### Community questions

Ask a question

### Was this page useful?

HelpfulCould be better