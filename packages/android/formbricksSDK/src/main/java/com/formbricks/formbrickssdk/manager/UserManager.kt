package com.formbricks.formbrickssdk.manager

import android.content.Context
import com.formbricks.formbrickssdk.Formbricks
import com.formbricks.formbrickssdk.api.FormbricksApi
import com.formbricks.formbrickssdk.extensions.dateString
import com.formbricks.formbrickssdk.extensions.expiresAt
import com.formbricks.formbrickssdk.extensions.guard
import com.formbricks.formbrickssdk.extensions.lastDisplayAt
import com.formbricks.formbrickssdk.logger.Logger
import com.formbricks.formbrickssdk.model.error.SDKError
import com.formbricks.formbrickssdk.model.enums.SuccessType
import com.formbricks.formbrickssdk.model.user.Display
import com.formbricks.formbrickssdk.network.queue.UpdateQueue
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.Date
import java.util.Timer
import java.util.TimerTask

/**
 * Store and manage user state and sync with the server when needed.
 */
object UserManager {
    private const val FORMBROCKS_PERFS = "formbricks_prefs"
    private const val USER_ID_KEY = "userIdKey"
    private const val CONTACT_ID_KEY = "contactIdKey"
    private const val SEGMENTS_KEY = "segmentsKey"
    private const val DISPLAYS_KEY = "displaysKey"
    private const val RESPONSES_KEY = "responsesKey"
    private const val LAST_DISPLAYED_AT_KEY = "lastDisplayedAtKey"
    private const val EXPIRES_AT_KEY = "expiresAtKey"
    private val prefManager by lazy { Formbricks.applicationContext.getSharedPreferences(FORMBROCKS_PERFS, Context.MODE_PRIVATE) }

    private var backingUserId: String? = null
    private var backingContactId: String? = null
    private var backingSegments: List<String>? = null
    private var backingDisplays: List<Display>? = null
    private var backingResponses: List<String>? = null
    private var backingLastDisplayedAt: Date? = null
    private var backingExpiresAt: Date? = null
    internal val syncTimer = Timer()

    /**
     * Starts an update queue with the given user id.
     *
     * @param userId
     */
    fun set(userId: String) {
        UpdateQueue.current.setUserId(userId)
    }

    /**
     * Starts an update queue with the given attribute.
     *
     * @param attribute
     * @param key
     */
    fun addAttribute(attribute: String, key: String) {
        UpdateQueue.current.addAttribute(key, attribute)
    }

    /**
     * Starts an update queue with the given attributes.
     *
     * @param attributes
     */
    fun setAttributes(attributes: Map<String, String>) {
        UpdateQueue.current.setAttributes(attributes)
    }

    /**
     * Starts an update queue with the given language..
     *
     * @param language
     */
    fun setLanguage(language: String) {
        UpdateQueue.current.setLanguage(language)
    }

    /**
     * Saves [surveyId] to the [displays] property and the the current date to the [lastDisplayedAt] property.
     *
     * @param surveyId
     */
    fun onDisplay(surveyId: String) {
        val lastDisplayedAt = Date()
        val newDisplays = displays?.toMutableList() ?: mutableListOf()
        newDisplays.add(Display(surveyId, lastDisplayedAt.dateString()))
        displays = newDisplays
        this.lastDisplayedAt = lastDisplayedAt
        SurveyManager.filterSurveys()
    }

    /**
     * Saves [surveyId] to the [responses] property.
     *
     * @param surveyId
     */
    fun onResponse(surveyId: String) {
        val newResponses = responses?.toMutableList() ?: mutableListOf()
        newResponses.add(surveyId)
        responses = newResponses
        SurveyManager.filterSurveys()
    }

    /**
     * Syncs the user state with the server if the user id is set and the expiration date has passed.
     */
    fun syncUserStateIfNeeded() {
        val id = userId
        val expiresAt = expiresAt
        if (id != null && expiresAt != null && Date().before(expiresAt)) {
            syncUser(id)
        } else {
            backingSegments = emptyList()
            backingDisplays = emptyList()
            backingResponses = emptyList()
        }
    }

    /**
     * Syncs the user state with the server, calls the [SurveyManager.filterSurveys] method and starts the sync timer.
     *
     * @param id
     * @param attributes
     */
    fun syncUser(id: String, attributes: Map<String, String>? = null) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val userResponse = FormbricksApi.postUser(id, attributes).getOrThrow()
                userId = userResponse.data.state.data.userId
                contactId = userResponse.data.state.data.contactId
                segments = userResponse.data.state.data.segments
                displays = userResponse.data.state.data.displays
                responses = userResponse.data.state.data.responses
                lastDisplayedAt = userResponse.data.state.data.lastDisplayAt()
                expiresAt = userResponse.data.state.expiresAt()
                val languageFromUserResponse = userResponse.data.state.data.language

                if(languageFromUserResponse != null) {
                    Formbricks.language = languageFromUserResponse
                }

                UpdateQueue.current.reset()
                SurveyManager.filterSurveys()
                startSyncTimer()
                Formbricks.callback?.onSuccess(SuccessType.SET_USER_SUCCESS)
            } catch (e: Exception) {
                val error = SDKError.unableToPostResponse
                Formbricks.callback?.onError(error)
                Logger.e(error)
            }
        }
    }

    /**
     * Logs out the user and clears the user state.
     */
    fun logout() {
        val isUserIdDefined = userId != null

        if (!isUserIdDefined) {
            val error = SDKError.noUserIdSetError
            Formbricks.callback?.onError(error)
            Logger.e(error)
        }

        prefManager.edit().apply {
            remove(CONTACT_ID_KEY)
            remove(USER_ID_KEY)
            remove(SEGMENTS_KEY)
            remove(DISPLAYS_KEY)
            remove(RESPONSES_KEY)
            remove(LAST_DISPLAYED_AT_KEY)
            remove(EXPIRES_AT_KEY)
            apply()
        }

        backingUserId = null
        backingContactId = null
        backingSegments = null
        backingDisplays = null
        backingResponses = null
        backingLastDisplayedAt = null
        backingExpiresAt = null
        Formbricks.language = "default"
        UpdateQueue.current.reset()

        if(isUserIdDefined) {
            Logger.d("User logged out successfully!")
        }
    }

    private fun startSyncTimer() {
        val expiresAt = expiresAt.guard { return }
        val userId = userId.guard { return }
        syncTimer.schedule(object: TimerTask() {
            override fun run() {
                syncUser(userId)
            }

        }, expiresAt)
    }


    var userId: String?
        get() = backingUserId ?: prefManager.getString(USER_ID_KEY, null).also { backingUserId = it }
        private set(value) {
            backingUserId = value
            prefManager.edit().putString(USER_ID_KEY, value).apply()
        }

    var contactId: String?
        get() = backingContactId ?: prefManager.getString(CONTACT_ID_KEY, null).also { backingContactId = it }
        private set(value) {
            backingContactId = value
            prefManager.edit().putString(CONTACT_ID_KEY, value).apply()
        }

    var segments: List<String>?
        get() = backingSegments ?: prefManager.getStringSet(SEGMENTS_KEY, emptySet())?.toList().also { backingSegments = it }
        private set(value) {
            backingSegments = value
            prefManager.edit().putStringSet(SEGMENTS_KEY, value?.toSet()).apply()
        }

    var displays: List<Display>?
        get() {
            if (backingDisplays == null) {
                val json = prefManager.getString(DISPLAYS_KEY, null)
                if (json != null) {
                    backingDisplays = Gson().fromJson(json, Array<Display>::class.java).toList()
                }
            }
            return backingDisplays
        }
        private set(value) {
            backingDisplays = value
            prefManager.edit().putString(DISPLAYS_KEY, Gson().toJson(value)).apply()
        }

    var responses: List<String>?
        get() = backingResponses ?: prefManager.getStringSet(RESPONSES_KEY, emptySet())?.toList().also { backingResponses = it }
        private set(value) {
            backingResponses = value
            prefManager.edit().putStringSet(RESPONSES_KEY, value?.toSet()).apply()
        }

    var lastDisplayedAt: Date?
        get() = backingLastDisplayedAt ?: prefManager.getLong(LAST_DISPLAYED_AT_KEY, 0L).takeIf { it > 0 }?.let { Date(it) }.also { backingLastDisplayedAt = it }
        private set(value) {
            backingLastDisplayedAt = value
            prefManager.edit().putLong(LAST_DISPLAYED_AT_KEY, value?.time ?: 0L).apply()
        }

    var expiresAt: Date?
        get() = backingExpiresAt ?: prefManager.getLong(EXPIRES_AT_KEY, 0L).takeIf { it > 0 }?.let { Date(it) }.also { backingExpiresAt = it }
        private set(value) {
            backingExpiresAt = value
            prefManager.edit().putLong(EXPIRES_AT_KEY, value?.time ?: 0L).apply()
        }
}