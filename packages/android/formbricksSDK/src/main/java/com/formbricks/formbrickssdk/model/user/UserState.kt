package com.formbricks.formbrickssdk.model.user

import com.google.gson.annotations.SerializedName

data class UserState(
    @SerializedName("data") val data: UserStateData,
    @SerializedName("expiresAt") val expiresAt: String?
)