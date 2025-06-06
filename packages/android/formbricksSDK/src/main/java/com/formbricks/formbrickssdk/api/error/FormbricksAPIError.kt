package com.formbricks.formbrickssdk.api.error

import com.google.gson.annotations.SerializedName

data class FormbricksAPIError(
    @SerializedName("code") val code: String,
    @SerializedName("message") val messageText: String,
    @SerializedName("details") val details: Map<String, String>? = null
) : RuntimeException(messageText)