package com.formbricks.formbrickssdk.network.queue

import com.formbricks.formbrickssdk.manager.UserManager
import timber.log.Timber
import java.util.*
import kotlin.concurrent.timer

/**
 * Update queue. This class is used to queue updates to the user.
 * The given properties will be sent to the backend and updated in
 * the user object when the debounce interval is reached.
 */
class UpdateQueue private constructor() {

    private var userId: String? = null
    private var attributes: MutableMap<String, String>? = null
    private var language: String? = null
    private var timer: Timer? = null

    fun setUserId(userId: String) {
        this.userId = userId
        startDebounceTimer()
    }

    fun setAttributes(attributes: Map<String, String>) {
        this.attributes = attributes.toMutableMap()
        startDebounceTimer()
    }

    fun addAttribute(key: String, attribute: String) {
        if (attributes == null) {
            attributes = mutableMapOf()
        }
        attributes?.put(key, attribute)
        startDebounceTimer()
    }

    fun setLanguage(language: String) {
        addAttribute("language", language)
        startDebounceTimer()
    }

    fun reset() {
        userId = null
        attributes = null
        language = null
    }

    private fun startDebounceTimer() {
        timer?.cancel()
        timer = timer("debounceTimer", false, DEBOUNCE_INTERVAL, DEBOUNCE_INTERVAL) {
            commit()
            timer?.cancel()
        }
    }

    private fun commit() {
        val currentUserId = userId
        if (currentUserId == null) {
            Timber.d("Error: User ID is not set yet")
            return
        }

        Timber.d("UpdateQueue - commit() called on UpdateQueue with $currentUserId and $attributes")
        UserManager.syncUser(currentUserId, attributes)
    }

    companion object {
        private const val DEBOUNCE_INTERVAL: Long = 500 // 500 ms
        val current: UpdateQueue = UpdateQueue()
    }
}