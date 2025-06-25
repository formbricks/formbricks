package com.formbricks.formbrickssdk.logger

import android.util.Log
import com.formbricks.formbrickssdk.Formbricks

object Logger {
    fun d(message: String) {
        if (Formbricks.loggingEnabled) {
            Log.d("FormbricksSDK", message)
        }
    }

    fun e(exception: RuntimeException) {
        if (Formbricks.loggingEnabled) {
            Log.e("FormbricksSDK", exception.localizedMessage, exception)
        }
    }

    fun w(message: String? = "Warning", exception: RuntimeException? = null) {
        if (Formbricks.loggingEnabled) {
            Log.w("FormbricksSDK", message, exception)
        }
    }
}