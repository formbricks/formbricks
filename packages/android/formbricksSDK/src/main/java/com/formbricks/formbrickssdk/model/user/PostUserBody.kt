package com.formbricks.formbrickssdk.model.user

import com.google.gson.annotations.SerializedName

data class PostUserBody(
    @SerializedName("userId") val userId: String,
    @SerializedName("attributes") val attributes: Map<String, *>?
) {
    companion object {
        fun create(userId: String, attributes: Map<String, *>?): PostUserBody {
            return PostUserBody(userId, attributes)
        }
    }
}