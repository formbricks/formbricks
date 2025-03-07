package com.formbricks.formbrickssdk.model.environment

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonIgnoreUnknownKeys

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonIgnoreUnknownKeys
data class Project(
    @SerializedName("id") val id: String?,
    @SerializedName("recontactDays") val recontactDays: Double?,
    @SerializedName("clickOutsideClose") val clickOutsideClose: Boolean?,
    @SerializedName("darkOverlay") val darkOverlay: Boolean?,
    @SerializedName("placement") val placement: String?,
    @SerializedName("inAppSurveyBranding") val inAppSurveyBranding: Boolean?,
    @SerializedName("styling") val styling: Styling?
)