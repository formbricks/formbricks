package com.formbricks.formbrickssdk.model.environment

import kotlinx.serialization.*
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.*
import kotlinx.serialization.descriptors.*
import kotlinx.serialization.encoding.*

// MARK: - Connector
@Serializable
enum class SegmentConnector {
    @SerialName("and") AND,
    @SerialName("or") OR
}

// MARK: - Filter Operators
@Serializable
enum class FilterOperator {
    @SerialName("lessThan") LESS_THAN,
    @SerialName("lessEqual") LESS_EQUAL,
    @SerialName("greaterThan") GREATER_THAN,
    @SerialName("greaterEqual") GREATER_EQUAL,
    @SerialName("equals") EQUALS,
    @SerialName("notEquals") NOT_EQUALS,
    @SerialName("contains") CONTAINS,
    @SerialName("doesNotContain") DOES_NOT_CONTAIN,
    @SerialName("startsWith") STARTS_WITH,
    @SerialName("endsWith") ENDS_WITH,
    @SerialName("isSet") IS_SET,
    @SerialName("isNotSet") IS_NOT_SET,
    @SerialName("userIsIn") USER_IS_IN,
    @SerialName("userIsNotIn") USER_IS_NOT_IN
}

// MARK: - Filter Value
@Serializable(with = SegmentFilterValueSerializer::class)
sealed class SegmentFilterValue {
    data class StringValue(val value: String) : SegmentFilterValue()
    data class NumberValue(val value: Double) : SegmentFilterValue()
}

object SegmentFilterValueSerializer : KSerializer<SegmentFilterValue> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("SegmentFilterValue", PrimitiveKind.STRING)
    override fun deserialize(decoder: Decoder): SegmentFilterValue {
        val jsonInput = decoder as JsonDecoder
        val element = jsonInput.decodeJsonElement()
        return when (element) {
            is JsonPrimitive -> {
                element.doubleOrNull?.let { SegmentFilterValue.NumberValue(it) }
                    ?: SegmentFilterValue.StringValue(element.content)
            }
            else -> throw SerializationException("Unexpected type for SegmentFilterValue: $element")
        }
    }
    override fun serialize(encoder: Encoder, value: SegmentFilterValue) {
        val jsonOutput = encoder as JsonEncoder
        val element = when (value) {
            is SegmentFilterValue.NumberValue -> JsonPrimitive(value.value)
            is SegmentFilterValue.StringValue -> JsonPrimitive(value.value)
        }
        jsonOutput.encodeJsonElement(element)
    }
}

// MARK: - Filter Root
@Serializable(with = SegmentFilterRootSerializer::class)
sealed class SegmentFilterRoot {
    data class Attribute(val contactAttributeKey: String) : SegmentFilterRoot()
    data class Person(val personIdentifier: String) : SegmentFilterRoot()
    data class Segment(val segmentId: String) : SegmentFilterRoot()
    data class Device(val deviceType: String) : SegmentFilterRoot()
}

object SegmentFilterRootSerializer : KSerializer<SegmentFilterRoot> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("SegmentFilterRoot") {
        element<String>("type")
    }
    override fun deserialize(decoder: Decoder): SegmentFilterRoot {
        val input = decoder as JsonDecoder
        val obj = input.decodeJsonElement().jsonObject
        return when (val type = obj["type"]?.jsonPrimitive?.content) {
            "attribute" -> SegmentFilterRoot.Attribute(obj["contactAttributeKey"]!!.jsonPrimitive.content)
            "person"    -> SegmentFilterRoot.Person(obj["personIdentifier"]!!.jsonPrimitive.content)
            "segment"   -> SegmentFilterRoot.Segment(obj["segmentId"]!!.jsonPrimitive.content)
            "device"    -> SegmentFilterRoot.Device(obj["deviceType"]!!.jsonPrimitive.content)
            else         -> throw SerializationException("Unknown root type: $type")
        }
    }
    override fun serialize(encoder: Encoder, value: SegmentFilterRoot) {
        val output = encoder as JsonEncoder
        val json = buildJsonObject {
            when (value) {
                is SegmentFilterRoot.Attribute -> {
                    put("type", JsonPrimitive("attribute"))
                    put("contactAttributeKey", JsonPrimitive(value.contactAttributeKey))
                }
                is SegmentFilterRoot.Person -> {
                    put("type", JsonPrimitive("person"))
                    put("personIdentifier", JsonPrimitive(value.personIdentifier))
                }
                is SegmentFilterRoot.Segment -> {
                    put("type", JsonPrimitive("segment"))
                    put("segmentId", JsonPrimitive(value.segmentId))
                }
                is SegmentFilterRoot.Device -> {
                    put("type", JsonPrimitive("device"))
                    put("deviceType", JsonPrimitive(value.deviceType))
                }
            }
        }
        output.encodeJsonElement(json)
    }
}

// MARK: - Qualifier
@Serializable
data class SegmentFilterQualifier(
    @SerialName("operator") val `operator`: FilterOperator
)

// MARK: - Primitive Filter
@Serializable
data class SegmentPrimitiveFilter(
    val id: String,
    val root: SegmentFilterRoot,
    val value: SegmentFilterValue,
    val qualifier: SegmentFilterQualifier
)

// MARK: - Recursive Resource
@Serializable(with = SegmentFilterResourceSerializer::class)
sealed class SegmentFilterResource {
    data class Primitive(val filter: SegmentPrimitiveFilter) : SegmentFilterResource()
    data class Group(val filters: List<SegmentFilter>) : SegmentFilterResource()
}

object SegmentFilterResourceSerializer : KSerializer<SegmentFilterResource> {
    override val descriptor = buildClassSerialDescriptor("SegmentFilterResource") {
        // You can declare children here if you like,
        // or leave it empty if you’re purely passing through.
    }
    override fun deserialize(decoder: Decoder): SegmentFilterResource {
        val input = decoder as JsonDecoder
        val element = input.decodeJsonElement()
        return if (element is JsonArray) {
            val list = element.map { input.json.decodeFromJsonElement(SegmentFilter.serializer(), it) }
            SegmentFilterResource.Group(list)
        } else {
            val prim = input.json.decodeFromJsonElement(SegmentPrimitiveFilter.serializer(), element)
            SegmentFilterResource.Primitive(prim)
        }
    }
    override fun serialize(encoder: Encoder, value: SegmentFilterResource) {
        val output = encoder as JsonEncoder
        val json = when (value) {
            is SegmentFilterResource.Primitive -> output.json.encodeToJsonElement(SegmentPrimitiveFilter.serializer(), value.filter)
            is SegmentFilterResource.Group     -> output.json.encodeToJsonElement(ListSerializer(SegmentFilter.serializer()), value.filters)
        }
        output.encodeJsonElement(json)
    }
}

// MARK: - Filter Node
@Serializable
data class SegmentFilter(
    val id: String,
    val connector: SegmentConnector? = null,
    val resource: SegmentFilterResource
)

// MARK: - Segment Model
@Serializable
data class Segment(
    val id: String,
    val title: String,
    val description: String? = null,
    @SerialName("isPrivate") val isPrivate: Boolean,
    val filters: List<SegmentFilter>,
    val environmentId: String,
    val createdAt: String,
    val updatedAt: String,
    val surveys: List<String>
)
