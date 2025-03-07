package com.formbricks.formbrickssdk.model.environment

import com.google.gson.annotations.SerializedName
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonIgnoreUnknownKeys

@Serializable
enum class DisplayOptionType {
    @SerializedName("respondMultiple") RESPOND_MULTIPLE,
    @SerializedName("displayOnce") DISPLAY_ONCE,
    @SerializedName("displayMultiple") DISPLAY_MULTIPLE,
    @SerializedName("displaySome") DISPLAY_SOME,
}

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonIgnoreUnknownKeys
data class Survey(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("triggers") val triggers: List<Trigger>?,
    @SerializedName("recontactDays") val recontactDays: Double?,
    @SerializedName("displayLimit") val displayLimit: Double?,
    @SerializedName("delay") val delay: Double?,
    @SerializedName("displayPercentage") val displayPercentage: Double?,
    @SerializedName("displayOption") val displayOption: DisplayOptionType?,
    @SerializedName("segment") val segment: Segment?,
    @SerializedName("styling") val styling: Styling?,
)