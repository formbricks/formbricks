package com.formbricks.formbrickssdk.helper

import androidx.annotation.Keep
import androidx.fragment.app.FragmentManager

/**
 * Configuration options for the SDK
 *
 * Use the [Builder] to configure the options, then pass the result of [build] to the setup method.
 */
@Keep
class FormbricksConfig private constructor(
    val appUrl: String,
    val environmentId: String,
    val userId: String?,
    val attributes: Map<String,String>?,
    val loggingEnabled: Boolean,
    val fragmentManager: FragmentManager?,
    val autoDismissErrors: Boolean = true,
) {
    class Builder(private val appUrl: String, private val environmentId: String) {
        private var userId: String? = null
        private var attributes: MutableMap<String,String> = mutableMapOf()
        private var loggingEnabled = false
        private var fragmentManager: FragmentManager? = null
        private var autoDismissErrors = true

        fun setUserId(userId: String): Builder {
            this.userId = userId
            return this
        }

        fun setAttributes(attributes: MutableMap<String,String>): Builder {
            this.attributes = attributes
            return this
        }

        fun addAttribute(attribute: String, key: String): Builder {
            this.attributes[key] = attribute
            return this
        }

        fun setLoggingEnabled(loggingEnabled: Boolean): Builder {
            this.loggingEnabled = loggingEnabled
            return this
        }

        fun setFragmentManager(fragmentManager: FragmentManager): Builder {
            this.fragmentManager = fragmentManager
            return this
        }

        fun setAutoDismissErrors(autoDismissErrors: Boolean): Builder {
            this.autoDismissErrors = autoDismissErrors
            return this
        }

        fun build(): FormbricksConfig {
            return FormbricksConfig(
                appUrl = appUrl,
                environmentId = environmentId,
                userId = userId,
                attributes = attributes,
                loggingEnabled = loggingEnabled,
                fragmentManager = fragmentManager,
                autoDismissErrors = autoDismissErrors
            )
        }
    }
}