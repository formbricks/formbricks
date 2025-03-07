package com.formbricks.formbrickssdk.model.javascript

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName

data class FileUploadData(
    @SerializedName("event") val event: EventType,
    @SerializedName("fileUploadParams") val fileUploadParams: FileUploadParams,
) {

    companion object {
        fun from(string: String): FileUploadData {
            return Gson().fromJson(string, FileUploadData::class.java)
        }
    }
}

data class FileUploadParams(
    @SerializedName("allowedFileExtensions") val allowedFileExtensions: String?,
    @SerializedName("allowMultipleFiles") val allowMultipleFiles: Boolean
) {
    fun allowedExtensionsArray(): Array<String> {
        return allowedFileExtensions?.split(",")?.map { it }?.toTypedArray() ?: arrayOf()
    }
}