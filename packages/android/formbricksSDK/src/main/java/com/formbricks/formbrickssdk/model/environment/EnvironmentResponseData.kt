package com.formbricks.formbrickssdk.model.environment

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.Serializable

@Serializable
data class EnvironmentResponseData(
    @SerializedName("data") val data: EnvironmentData,
    @SerializedName("expiresAt") val expiresAt: String?
)