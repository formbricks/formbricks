package com.formbricks.formbrickssdk.network

import com.formbricks.formbrickssdk.api.error.FormbricksAPIError
import com.formbricks.formbrickssdk.helper.mapToJsonElement
import com.formbricks.formbrickssdk.model.environment.EnvironmentDataHolder
import com.formbricks.formbrickssdk.model.environment.EnvironmentResponse
import com.formbricks.formbrickssdk.model.user.PostUserBody
import com.formbricks.formbrickssdk.model.user.UserResponse
import com.google.gson.Gson
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import retrofit2.Call
import retrofit2.Retrofit

open class FormbricksApiService {

    private lateinit var retrofit: Retrofit

    fun initialize(appUrl: String, isLoggingEnabled: Boolean) {
        retrofit = FormbricksRetrofitBuilder(appUrl, isLoggingEnabled)
            .getBuilder()
            .build()
    }

    open fun getEnvironmentStateObject(environmentId: String): Result<EnvironmentDataHolder> {
        val result = execute {
            retrofit.create(FormbricksService::class.java)
                .getEnvironmentState(environmentId)
        }

        val resultMap = result.getOrThrow()
        val resultJson = mapToJsonElement(resultMap).jsonObject
        val environmentResponse = Json.decodeFromJsonElement<EnvironmentResponse>(resultJson)
        val data = EnvironmentDataHolder(environmentResponse.data, resultMap)
        return Result.success(data)
    }

    open fun postUser(environmentId: String, body: PostUserBody): Result<UserResponse> {
        return execute {
            retrofit.create(FormbricksService::class.java)
                .postUser(environmentId, body)
        }
    }

    private inline fun <T> execute(apiCall: () -> Call<T>): Result<T> {
        val call = apiCall().execute()
        return if (call.isSuccessful) {
            val body = call.body()
            if (body == null) {
                Result.failure(RuntimeException("Invalid response"))
            } else {
                Result.success(body)
            }
        } else {
            return try {
                val errorResponse =
                    Gson().fromJson(call.errorBody()?.string(), FormbricksAPIError::class.java)
                Result.failure(errorResponse)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
}