struct Config {
    struct Environment {
        /// On error, the environment will be refreshed after this amount of time (in minutes)
        static let refreshStateOnErrorTimeoutInMinutes = 10
        /// The survey window will be closed after this amount of time (in seconds) when the `onFinished` javascript callback is called.
        static let closingTimeoutInSeconds = 5
    }
}
