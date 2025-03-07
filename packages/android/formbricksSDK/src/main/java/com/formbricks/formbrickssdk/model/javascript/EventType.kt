package com.formbricks.formbrickssdk.model.javascript

import com.google.gson.annotations.SerializedName

enum class EventType {
    @SerializedName("onClose")  ON_CLOSE,
    @SerializedName("onFinished") ON_FINISHED,
    @SerializedName("onDisplayCreated") ON_DISPLAY_CREATED,
    @SerializedName("onResponseCreated") ON_RESPONSE_CREATED,
    @SerializedName("onFilePick") ON_FILE_PICK,
}