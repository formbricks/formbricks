package com.formbricks.formbrickssdk.network

import com.formbricks.formbrickssdk.model.upload.FetchStorageUrlRequestBody
import com.formbricks.formbrickssdk.model.upload.FetchStorageUrlResponse
import com.formbricks.formbrickssdk.model.user.PostUserBody
import com.formbricks.formbrickssdk.model.user.UserResponse
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface FormbricksService {

    @GET("$API_PREFIX/client/{environmentId}/environment")
    fun getEnvironmentState(@Path("environmentId") environmentId: String): Call<Map<String, Any>>

    @POST("$API_PREFIX/client/{environmentId}/user")
    fun postUser(@Path("environmentId") environmentId: String, @Body body: PostUserBody): Call<UserResponse>

    @POST("$API_PREFIX/client/{environmentId}/storage")
    fun fetchStorageUrl(@Path("environmentId") environmentId: String, @Body body: FetchStorageUrlRequestBody): Call<FetchStorageUrlResponse>

//    @POST("{path}")
//    fun uploadFile(@Path("path") path: String, @Body fileUploadBody: FileUploadBody): Call<Map<String, Any>>

    companion object {
        const val API_PREFIX = "/api/v1"
    }

}