package com.formbricks.formbrickssdk.model.error

object SDKError {
    val sdkIsNotInitialized = RuntimeException("Formbricks SDK is not initialized")
    val fragmentManagerIsNotSet = RuntimeException("The fragment manager is not set.")
    val connectionIsNotAvailable = RuntimeException("There is no connection.")
}