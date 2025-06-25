package com.formbricks.formbrickssdk.model.user

import com.google.gson.annotations.SerializedName

data class UserStateData(
    @SerializedName("userId") val userId: String?,
    @SerializedName("contactId") val contactId: String?,
    @SerializedName("segments") val segments: List<String>?,
    @SerializedName("displays") val displays: List<Display>?,
    @SerializedName("responses") val responses: List<String>?,
    @SerializedName("lastDisplayAt") val lastDisplayAt: String?,
    @SerializedName("language") val language: String?
)
