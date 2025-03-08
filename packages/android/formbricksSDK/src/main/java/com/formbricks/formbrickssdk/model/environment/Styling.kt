package com.formbricks.formbrickssdk.model.environment

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonIgnoreUnknownKeys

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonIgnoreUnknownKeys
data class Styling(
    @SerializedName("roundness") val roundness: Double? = null,
    @SerializedName("allowStyleOverwrite") val allowStyleOverwrite: Boolean? = null,
)