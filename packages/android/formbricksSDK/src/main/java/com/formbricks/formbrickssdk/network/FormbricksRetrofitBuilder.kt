package com.formbricks.formbrickssdk.network

import com.formbricks.formbrickssdk.network.utils.UnsafeOkHttpClient
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.InputStream
import java.util.concurrent.TimeUnit

class FormbricksRetrofitBuilder(
    private val baseUrl: String,
    private val loggingEnabled: Boolean,
    private val certificates: MutableList<InputStream>
) {

    fun getBuilder(): Retrofit.Builder {
        val okHttpClient = if (certificates.isNotEmpty()) {
            UnsafeOkHttpClient.getClient(certificates).newBuilder()

        } else {
            OkHttpClient.Builder()
        }
        val clientBuilder = okHttpClient
            .connectTimeout(CONNECT_TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
            .readTimeout(READ_TIMEOUT_MS.toLong(), TimeUnit.MILLISECONDS)
            .followSslRedirects(true)
        if (loggingEnabled) {
            val logging = HttpLoggingInterceptor()
            logging.setLevel(HttpLoggingInterceptor.Level.BODY)
            clientBuilder.addInterceptor(logging)
        }

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .addConverterFactory(GsonConverterFactory.create())
            .client(clientBuilder.build())
    }

    companion object {
        private const val CONNECT_TIMEOUT_MS = 30 * 1000 // 30 seconds
        private const val READ_TIMEOUT_MS = 30 * 1000 // 30 seconds
    }
}