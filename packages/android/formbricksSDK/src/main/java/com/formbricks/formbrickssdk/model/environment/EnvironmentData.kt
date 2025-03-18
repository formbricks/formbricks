package com.formbricks.formbrickssdk.model.environment

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonIgnoreUnknownKeys

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonIgnoreUnknownKeys
data class EnvironmentData(
    @SerializedName("surveys") val surveys: List<Survey>?,
    @SerializedName("actionClasses") val actionClasses: List<ActionClass>?,
    @SerializedName("project") val project: Project
)