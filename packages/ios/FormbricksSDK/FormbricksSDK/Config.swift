struct Config {
    struct Environment {
        /// On error, the environment will be refreshed after this amount of time (in minutes)
        static let refreshStateOnErrorTimeoutInMinutes = 10
    }
}
