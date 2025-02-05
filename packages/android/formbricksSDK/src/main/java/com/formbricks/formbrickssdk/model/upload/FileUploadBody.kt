//package com.formbricks.formbrickssdk.model.upload
//
//import com.formbricks.formbrickssdk.model.javascript.FileData
//import com.google.gson.annotations.SerializedName
//
//data class FileUploadBody(
//    @SerializedName("fileName") val fileName: String,
//    @SerializedName("fileType") val fileType: String,
//    @SerializedName("surveyId") val surveyId: String?,
//    @SerializedName("signature") val signature: String,
//    @SerializedName("timestamp") val timestamp: String,
//    @SerializedName("uuid") val uuid: String,
//    @SerializedName("fileBase64String") val fileBase64String: String,
//) {
//    companion object {
//        fun create(file: FileData, storageData: StorageData, surveyId: String?): FileUploadBody {
//            return FileUploadBody(
//                fileName = storageData.updatedFileName,
//                fileType = file.type,
//                surveyId = surveyId,
//                signature = storageData.signingData.signature,
//                uuid = storageData.signingData.uuid,
//                timestamp = storageData.signingData.timestamp.toString(),
//                fileBase64String = file.base64
//            )
//        }
//    }
//}