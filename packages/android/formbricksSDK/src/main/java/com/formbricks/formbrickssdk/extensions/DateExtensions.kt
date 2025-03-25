package com.formbricks.formbrickssdk.extensions

import com.formbricks.formbrickssdk.model.environment.EnvironmentDataHolder
import com.formbricks.formbrickssdk.model.user.UserState
import com.formbricks.formbrickssdk.model.user.UserStateData
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal const val dateFormatPattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"

fun Date.dateString(): String {
    val dateFormat = SimpleDateFormat(dateFormatPattern, Locale.getDefault())
    dateFormat.timeZone = TimeZone.getTimeZone("UTC")
    return dateFormat.format(this)
}

fun UserStateData.lastDisplayAt(): Date? {
    lastDisplayAt?.let {
        try {
            val formatter = SimpleDateFormat(dateFormatPattern, Locale.getDefault())
            formatter.timeZone = TimeZone.getTimeZone("UTC")
            return formatter.parse(it)
        } catch (e: Exception) {
           return null
        }
    }

    return null
}

fun UserState.expiresAt(): Date? {
    expiresAt?.let {
        try {
            val formatter = SimpleDateFormat(dateFormatPattern, Locale.getDefault())
            formatter.timeZone = TimeZone.getTimeZone("UTC")
            return formatter.parse(it)
        } catch (e: Exception) {
            return null
        }
    }

    return null
}

fun EnvironmentDataHolder.expiresAt(): Date? {
    data?.expiresAt?.let {
        try {
            val formatter = SimpleDateFormat(dateFormatPattern, Locale.getDefault())
            formatter.timeZone = TimeZone.getTimeZone("UTC")
            return formatter.parse(it)
        } catch (e: Exception) {
            return null
        }
    }

    return null
}