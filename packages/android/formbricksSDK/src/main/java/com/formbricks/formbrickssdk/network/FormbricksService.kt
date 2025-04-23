package com.formbricks.formbrickssdk.network

import com.formbricks.formbrickssdk.model.user.PostUserBody
import com.formbricks.formbrickssdk.model.user.UserResponse
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface FormbricksService {
    @GET("$API_PREFIX/client/{environmentId}/environment")
    fun getEnvironmentState(@Path("environmentId") environmentId: String, @Query("randQuery") randQuery: String = System.currentTimeMillis().toString()): Call<Map<String, Any>>

    @POST("$API_PREFIX/client/{environmentId}/user")
    fun postUser(@Path("environmentId") environmentId: String, @Body body: PostUserBody, @Query("randQuery") randQuery: String = System.currentTimeMillis().toString()): Call<UserResponse>

    companion object {
        const val API_PREFIX = "/api/v2"
    }
}