package com.formbricks.formbrickssdk.model.environment

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.Serializable

@Serializable
data class Segment(
    @SerializedName("id") val id: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("isPrivate") val isPrivate: Boolean? = null,
    @SerializedName("filters") val filters: List<String>? = null,
    @SerializedName("environmentId") val environmentId: String? = null,
    @SerializedName("surveys") val surveys: List<String>? = null
)