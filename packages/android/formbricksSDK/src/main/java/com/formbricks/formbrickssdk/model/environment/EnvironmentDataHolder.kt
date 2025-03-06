package com.formbricks.formbrickssdk.model.environment

import com.google.gson.Gson
import com.google.gson.JsonElement

data class EnvironmentDataHolder(
    val data: EnvironmentResponseData?,
    val originalResponseMap: Map<String, Any>
)

@Suppress("UNCHECKED_CAST")
fun EnvironmentDataHolder.getSurveyJson(surveyId: String): JsonElement? {
    val responseMap = originalResponseMap["data"] as? Map<*, *>
    val dataMap = responseMap?.get("data") as? Map<*, *>
    val surveyArray = dataMap?.get("surveys") as? ArrayList<Map<String, Any?>>
    val firstSurvey = surveyArray?.firstOrNull { it["id"] == surveyId }
    firstSurvey?.let {
        return Gson().toJsonTree(it)
    }

    return null
}

@Suppress("UNCHECKED_CAST")
fun EnvironmentDataHolder.getStyling(surveyId: String): JsonElement? {
    val responseMap = originalResponseMap["data"] as? Map<*, *>
    val dataMap = responseMap?.get("data") as? Map<*, *>
    val surveyArray = dataMap?.get("surveys") as? ArrayList<Map<String, Any?>>
    val firstSurvey = surveyArray?.firstOrNull { it["id"] == surveyId }
    firstSurvey?.get("styling")?.let {
        return Gson().toJsonTree(it)
    }

    return null
}

@Suppress("UNCHECKED_CAST")
fun EnvironmentDataHolder.getProjectStylingJson(): JsonElement? {
    val responseMap = originalResponseMap["data"] as? Map<*, *>
    val dataMap = responseMap?.get("data") as? Map<*, *>
    val projectMap = dataMap?.get("project") as? Map<*, *>
    val stylingMap = projectMap?.get("styling") as? Map<String, Any?>
    stylingMap?.let {
        return Gson().toJsonTree(it)
    }

    return null
}