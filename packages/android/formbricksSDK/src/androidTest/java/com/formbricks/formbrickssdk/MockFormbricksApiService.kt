package com.formbricks.formbrickssdk

import com.formbricks.formbrickssdk.model.environment.EnvironmentDataHolder
import com.formbricks.formbrickssdk.model.environment.EnvironmentResponse
import com.formbricks.formbrickssdk.model.user.PostUserBody
import com.formbricks.formbrickssdk.model.user.UserResponse
import com.formbricks.formbrickssdk.network.FormbricksApiService
import com.google.gson.Gson

class MockFormbricksApiService: FormbricksApiService() {
    private val gson = Gson()
    private val environmentJson = MockFormbricksApiService::class.java.getResource("/Environment.json")!!.readText()
    private val userJson = MockFormbricksApiService::class.java.getResource("/User.json")!!.readText()
    private val environment = gson.fromJson(environmentJson, EnvironmentResponse::class.java)
    private val user = gson.fromJson(userJson, UserResponse::class.java)
    var isErrorResponseNeeded = false

    override fun getEnvironmentStateObject(environmentId: String): Result<EnvironmentDataHolder> {
        return if (isErrorResponseNeeded) {
            Result.failure(RuntimeException())
        } else {
            Result.success(EnvironmentDataHolder(environment.data, mapOf()))
        }
    }

    override fun postUser(environmentId: String, body: PostUserBody): Result<UserResponse> {
        return if (isErrorResponseNeeded) {
            Result.failure(RuntimeException())
        } else {
            Result.success(user)
        }

    }

}