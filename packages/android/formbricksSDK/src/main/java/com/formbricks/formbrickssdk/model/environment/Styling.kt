package com.formbricks.formbrickssdk.model.environment

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.Serializable

@Serializable
data class Styling(
    @SerializedName("roundness") val roundness: Double? = null,
    @SerializedName("allowStyleOverwrite") val allowStyleOverwrite: Boolean? = null,
)