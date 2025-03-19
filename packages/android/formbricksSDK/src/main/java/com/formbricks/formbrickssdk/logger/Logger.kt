package com.formbricks.formbrickssdk.logger

import android.util.Log
import com.formbricks.formbrickssdk.Formbricks

object Logger {
    fun d(message: String) {
        if (Formbricks.loggingEnabled) {
            Log.d("FormbricksSDK", message)
        }
    }

    fun e(message: String? = "Exception", exception: RuntimeException? = null) {
        if (Formbricks.loggingEnabled) {
            Log.e("FormbricksSDK", message, exception)
        }
    }

    fun w(message: String? = "Warning", exception: RuntimeException? = null) {
        if (Formbricks.loggingEnabled) {
            Log.w("FormbricksSDK", message, exception)
        }
    }
}