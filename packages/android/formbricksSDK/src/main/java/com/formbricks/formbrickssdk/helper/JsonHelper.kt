package com.formbricks.formbrickssdk.helper

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

fun mapToJsonElement(map: Map<String, Any?>): JsonElement {
    return buildJsonObject {
        map.forEach { (key, value) ->
            when (value) {
                is String -> put(key, value)
                is Number -> put(key, value)
                is Boolean -> put(key, value)
                is Map<*, *> -> {
                    @Suppress("UNCHECKED_CAST")
                    put(key, mapToJsonElement(value as Map<String, Any?>))
                }
                is List<*> -> {
                    put(key, JsonArray(value.map { elem -> mapToJsonElementItem(elem) }))
                }
                null -> put(key, JsonNull)
                else -> throw IllegalArgumentException("Unsupported type: ${value::class}")
            }
        }
    }
}

fun mapToJsonElementItem(value: Any?): JsonElement {
    return when (value) {
        is String -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is Map<*, *> -> {
            @Suppress("UNCHECKED_CAST")
            mapToJsonElement(value as Map<String, Any?>)
        }
        is List<*> -> JsonArray(value.map { elem -> mapToJsonElementItem(elem) })
        null -> JsonNull
        else -> throw IllegalArgumentException("Unsupported type: ${value::class}")
    }
}