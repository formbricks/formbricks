package com.formbricks.formbrickssdk.model.upload

import com.google.gson.annotations.SerializedName

data class SigningData(
    @SerializedName("signature") val signature: String,
    @SerializedName("timestamp") val timestamp: Long,
    @SerializedName("uuid") val uuid: String
)