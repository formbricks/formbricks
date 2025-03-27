package com.formbricks.formbrickssdk

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.annotation.Keep
import androidx.fragment.app.FragmentManager
import com.formbricks.formbrickssdk.api.FormbricksApi
import com.formbricks.formbrickssdk.helper.FormbricksConfig
import com.formbricks.formbrickssdk.logger.Logger
import com.formbricks.formbrickssdk.manager.SurveyManager
import com.formbricks.formbrickssdk.manager.UserManager
import com.formbricks.formbrickssdk.model.error.SDKError
import com.formbricks.formbrickssdk.webview.FormbricksFragment
import java.io.InputStream

@Keep
interface FormbricksCallback {
    fun onSurveyStarted()
    fun onSurveyFinished()
    fun onSurveyClosed()
    fun onError(error: Exception)
}

@Keep
object Formbricks {
    internal lateinit var applicationContext: Context

    internal lateinit var environmentId: String
    internal lateinit var appUrl: String
    internal var language: String = "default"
    internal var loggingEnabled: Boolean = true
    internal lateinit var certificates: MutableList<InputStream>
    private var fragmentManager: FragmentManager? = null
    internal var isInitialized = false
    var callback: FormbricksCallback? = null

    /**
     * Initializes the Formbricks SDK with the given [Context] config [FormbricksConfig].
     * This method is mandatory to be called, and should be only once per application lifecycle.
     * To show a survey, the SDK needs a [FragmentManager] instance.
     *
     * ```
     * class MainActivity : FragmentActivity() {
     *
     *     override fun onCreate() {
     *         super.onCreate()
     *         val config = FormbricksConfig.Builder("http://localhost:3000","my_environment_id")
     *             .setLoggingEnabled(true)
     *             .setFragmentManager(supportFragmentManager)
     *            .build())
     *         Formbricks.setup(this, config.build())
     *     }
     * }
     * ```
     *
     */
    fun setup(context: Context, config: FormbricksConfig, forceRefresh: Boolean = false) {
        if (isInitialized) {
            val error = SDKError.sdkIsAlreadyInitialized
            callback?.onError(error)
            Logger.e(error)
            return
        }

        applicationContext = context

        appUrl = config.appUrl
        environmentId = config.environmentId
        loggingEnabled = config.loggingEnabled
        fragmentManager = config.fragmentManager
        certificates = config.certificateInputStreams?.toMutableList() ?: mutableListOf()
        config.userId?.let { UserManager.set(it) }
        config.attributes?.let { UserManager.setAttributes(it) }
        config.attributes?.get("language")?.let { UserManager.setLanguage(it) }

        FormbricksApi.initialize()
        SurveyManager.refreshEnvironmentIfNeeded(force = forceRefresh)
        UserManager.syncUserStateIfNeeded()

        isInitialized = true
    }

    /**
     * Sets the user id for the current user with the given [String].
     * The SDK must be initialized before calling this method.
     *
     * ```
     * Formbricks.setUserId("my_user_id")
     * ```
     *
     */
    fun setUserId(userId: String) {
        if (!isInitialized) {
            val error = SDKError.sdkIsNotInitialized
            callback?.onError(error)
            Logger.e(error)
            return

        }
        UserManager.set(userId)
    }

    /**
     * Adds an attribute for the current user with the given [String] value and [String] key.
     * The SDK must be initialized before calling this method.
     *
     * ```
     * Formbricks.setAttribute("my_attribute", "key")
     * ```
     *
     */
    fun setAttribute(attribute: String, key: String) {
        if (!isInitialized) {
            val error = SDKError.sdkIsNotInitialized
            callback?.onError(error)
            Logger.e(error)
            return
        }
        UserManager.addAttribute(attribute, key)
    }

    /**
     * Sets the user attributes for the current user with the given [Map] of [String] values and [String] keys.
     * The SDK must be initialized before calling this method.
     *
     * ```
     * Formbricks.setAttributes(mapOf(Pair("key", "my_attribute")))
     * ```
     *
     */
    fun setAttributes(attributes: Map<String, String>) {
        if (!isInitialized) {
            val error = SDKError.sdkIsNotInitialized
            callback?.onError(error)
            Logger.e(error)
            return
        }
        UserManager.setAttributes(attributes)
    }

    /**
     * Sets the language for the current user with the given [String].
     * The SDK must be initialized before calling this method.
     *
     * ```
     * Formbricks.setLanguage("de")
     * ```
     *
     */
    fun setLanguage(language: String) {
        if (!isInitialized) {
            val error = SDKError.sdkIsNotInitialized
            callback?.onError(error)
            Logger.e(error)
            return
        }
        Formbricks.language = language
        UserManager.setLanguage(language)
    }

    /**
     * Tracks an action with the given [String]. The SDK will process the action and it will present the survey if any of them can be triggered.
     * The SDK must be initialized before calling this method.
     *
     * ```
     * Formbricks.track("button_clicked")
     * ```
     *
     */
    fun track(action: String) {
        if (!isInitialized) {
            val error = SDKError.sdkIsNotInitialized
            callback?.onError(error)
            Logger.e(error)
            return
        }

        if (!isInternetAvailable()) {
            val error = SDKError.connectionIsNotAvailable
            callback?.onError(error)
            Logger.e(error)
            return
        }

        SurveyManager.track(action)
    }

    /**
     * Logs out the current user. This will clear the user attributes and the user id.
     * The SDK must be initialized before calling this method.
     *
     * ```
     * Formbricks.logout()
     * ```
     *
     */
    fun logout() {
        if (!isInitialized) {
            val error = SDKError.sdkIsNotInitialized
            callback?.onError(error)
            Logger.e(error)
            return
        }

        UserManager.logout()
    }

    /**
     * Sets the [FragmentManager] instance. The SDK always needs the actual [FragmentManager] to
     * display surveys, so make sure you update it whenever it changes.
     * The SDK must be initialized before calling this method.
     *
     * ```
     * Formbricks.setFragmentManager(supportFragmentMananger)
     * ```
     *
     */
    fun setFragmentManager(fragmentManager: FragmentManager) {
        this.fragmentManager = fragmentManager
    }

    /// Assembles the survey fragment and presents it
    internal fun showSurvey(id: String) {
        if (fragmentManager == null) {
            val error = SDKError.fragmentManagerIsNotSet
            callback?.onError(error)
            Logger.e(error)
            return
        }

        fragmentManager?.let {
            FormbricksFragment.show(it, surveyId = id)
        }
    }

    /// Checks if the phone has active network connection
    private fun isInternetAvailable(): Boolean {
        val connectivityManager = applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}