package com.formbricks.formbrickssdk.model.upload

import com.google.gson.annotations.SerializedName

data class StorageData(
    @SerializedName("signedUrl") val signedUrl: String,
    @SerializedName("signingData") val signingData: SigningData,
    @SerializedName("updatedFileName") val updatedFileName: String,
    @SerializedName("fileUrl") val fileUrl: String
)