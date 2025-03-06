package com.formbricks.formbrickssdk.model.javascript

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

data class JsMessageData(
    @SerializedName("event") val event: EventType,
) {
    companion object {
        fun from(string: String): JsMessageData {
            return try {
                Gson().fromJson(string, JsMessageData::class.java)
            } catch (e: Exception) {
                throw IllegalArgumentException("Invalid JSON format: ${e.message}", e)
            }
        }
    }
}