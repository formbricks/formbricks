package com.formbricks.formbrickssdk.model.environment

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.Serializable

@Serializable
data class EnvironmentData(
    @SerializedName("surveys") val surveys: List<Survey>?,
    @SerializedName("actionClasses") val actionClasses: List<ActionClass>?,
    @SerializedName("project") val project: Project
)