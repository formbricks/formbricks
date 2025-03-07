//package com.formbricks.formbrickssdk.network
//
//import com.formbricks.formbrickssdk.api.error.FormbricksAPIError
//import com.formbricks.formbrickssdk.model.upload.FileUploadBody
//import com.google.gson.Gson
//import retrofit2.Call
//import retrofit2.Retrofit
//
//class FormbricksFileUploadService(appUrl: String, isLoggingEnabled: Boolean) {
//    private var retrofit: Retrofit = FormbricksRetrofitBuilder(appUrl, isLoggingEnabled)
//        .getBuilder()
//        .build()
//
//
//    fun uploadFile(path: String, body: FileUploadBody): Result<Map<String, *>> {
//        return execute {
//            retrofit.create(FormbricksService::class.java)
//                .uploadFile(path, body)
//        }
//    }
//
//    private inline fun <T> execute(apiCall: () -> Call<T>): Result<T> {
//        val call = apiCall().execute()
//        return if (call.isSuccessful) {
//            val body = call.body()
//            if (body == null) {
//                Result.failure(RuntimeException("Invalid response"))
//            } else {
//                Result.success(body)
//            }
//        } else {
//            return try {
//                val errorResponse =
//                    Gson().fromJson(call.errorBody()?.string(), FormbricksAPIError::class.java)
//                Result.failure(errorResponse)
//            } catch (e: Exception) {
//                Result.failure(e)
//            }
//        }
//    }
//}