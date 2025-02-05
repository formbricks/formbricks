package com.formbricks.formbrickssdk.model.javascript

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

data class JsMessageData(
    @SerializedName("event") val event: EventType,
) {
    companion object {
        fun from(string: String): JsMessageData {
            return Gson().fromJson(string, JsMessageData::class.java)
        }
    }
}