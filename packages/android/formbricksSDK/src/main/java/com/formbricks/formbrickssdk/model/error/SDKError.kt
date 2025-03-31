package com.formbricks.formbrickssdk.model.error

import androidx.annotation.Keep

@Keep
object SDKError {
    val sdkIsNotInitialized = RuntimeException("Formbricks SDK is not initialized")
    val sdkIsAlreadyInitialized = RuntimeException("Formbricks SDK is already initialized")
    val fragmentManagerIsNotSet = RuntimeException("The fragment manager is not set.")
    val connectionIsNotAvailable = RuntimeException("There is no connection.")
    val unableToLoadFormbicksJs = RuntimeException("Unable to load Formbricks Javascript package.")
    val surveyDisplayFetchError =
        RuntimeException("Error: creating display: TypeError: Failure to fetch the survey data.")
    val surveyNotDisplayedError = RuntimeException("Survey was not displayed due to display percentage restrictions.")
    val unableToRefreshEnvironment = RuntimeException("Unable to refresh environment state.")
    val missingSurveyId = RuntimeException("Survey id is mandatory to set.")
    val invalidDisplayOption = RuntimeException("Invalid Display Option.")
    val unableToPostResponse = RuntimeException("Unable to post survey response.")
}