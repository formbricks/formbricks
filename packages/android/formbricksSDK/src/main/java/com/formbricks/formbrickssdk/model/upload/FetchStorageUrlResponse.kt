package com.formbricks.formbrickssdk.model.upload

import com.google.gson.annotations.SerializedName

data class FetchStorageUrlResponse(
    @SerializedName("data") val data: StorageData
)