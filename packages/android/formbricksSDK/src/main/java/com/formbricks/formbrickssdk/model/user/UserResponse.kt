package com.formbricks.formbrickssdk.model.user

import com.google.gson.annotations.SerializedName

data class UserResponse(
    @SerializedName("data") val data: UserResponseData
)