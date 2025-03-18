package com.formbricks.formbrickssdk.model.environment

import com.formbricks.formbrickssdk.model.BaseFormbricksResponse
import com.google.gson.annotations.SerializedName
import kotlinx.serialization.Serializable

@Serializable
data class EnvironmentResponse(
    @SerializedName("data") val data: EnvironmentResponseData,
): BaseFormbricksResponse