package com.formbricks.formbrickssdk.model.user

import com.google.gson.annotations.SerializedName


data class UserStateData(
    @SerializedName("userId") val userId: String?,
    @SerializedName("segments") val segments: List<String>?,
    @SerializedName("displays") val displays: List<Display>?,
    @SerializedName("responses") val responses: List<String>?,
    @SerializedName("lastDisplayAt") val lastDisplayAt: String?
)

