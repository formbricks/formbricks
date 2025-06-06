package com.formbricks.formbrickssdk.model.user

import com.google.gson.annotations.SerializedName

data class Display(
    @SerializedName("surveyId") val surveyId: String,
    @SerializedName("createdAt") val createdAt: String
)