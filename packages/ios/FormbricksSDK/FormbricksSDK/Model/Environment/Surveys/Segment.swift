import Foundation

// MARK: - Connector

enum SegmentConnector: String, Codable {
    case and
    case or
}

// MARK: - Filter Operators

/// Combined operator set for all filter types
enum FilterOperator: String, Codable {
    // Base / Arithmetic
    case lessThan
    case lessEqual
    case greaterThan
    case greaterEqual
    case equals
    case notEquals
    // Attribute / String
    case contains
    case doesNotContain
    case startsWith
    case endsWith
    // Existence
    case isSet
    case isNotSet
    // Segment membership
    case userIsIn
    case userIsNotIn
}

// MARK: - Filter Value

enum SegmentFilterValue: Codable {
    case string(String)
    case number(Double)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let num = try? container.decode(Double.self) {
            self = .number(num)
        } else if let str = try? container.decode(String.self) {
            self = .string(str)
        } else {
            throw DecodingError.typeMismatch(
                SegmentFilterValue.self,
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "Value is neither Double nor String"
                )
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .number(let num):
            try container.encode(num)
        case .string(let str):
            try container.encode(str)
        }
    }
}

// MARK: - Root

enum SegmentFilterRoot: Codable {
    case attribute(contactAttributeKey: String)
    case person(personIdentifier: String)
    case segment(segmentId: String)
    case device(deviceType: String)

    private enum CodingKeys: String, CodingKey {
        case type
        case contactAttributeKey
        case personIdentifier
        case segmentId
        case deviceType
    }

    private enum RootType: String, Codable {
        case attribute
        case person
        case segment
        case device
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(RootType.self, forKey: .type)
        switch type {
        case .attribute:
            let key = try container.decode(String.self, forKey: .contactAttributeKey)
            self = .attribute(contactAttributeKey: key)
        case .person:
            let id = try container.decode(String.self, forKey: .personIdentifier)
            self = .person(personIdentifier: id)
        case .segment:
            let id = try container.decode(String.self, forKey: .segmentId)
            self = .segment(segmentId: id)
        case .device:
            let type = try container.decode(String.self, forKey: .deviceType)
            self = .device(deviceType: type)
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .attribute(let key):
            try container.encode(RootType.attribute, forKey: .type)
            try container.encode(key, forKey: .contactAttributeKey)
        case .person(let id):
            try container.encode(RootType.person, forKey: .type)
            try container.encode(id, forKey: .personIdentifier)
        case .segment(let id):
            try container.encode(RootType.segment, forKey: .type)
            try container.encode(id, forKey: .segmentId)
        case .device(let type):
            try container.encode(RootType.device, forKey: .type)
            try container.encode(type, forKey: .deviceType)
        }
    }
}

// MARK: - Qualifier

struct SegmentFilterQualifier: Codable {
    let `operator`: FilterOperator
}

// MARK: - Primitive Filter

struct SegmentPrimitiveFilter: Codable {
    let id: String
    let root: SegmentFilterRoot
    let value: SegmentFilterValue
    let qualifier: SegmentFilterQualifier

    // Add run-time refinements if needed
}

// MARK: - Recursive Filter Resource

enum SegmentFilterResource: Codable {
    case primitive(SegmentPrimitiveFilter)
    case group([SegmentFilter])

    init(from decoder: Decoder) throws {
        // Try primitive first
        if let prim = try? SegmentPrimitiveFilter(from: decoder) {
            self = .primitive(prim)
        } else {
            let nested = try [SegmentFilter](from: decoder)
            self = .group(nested)
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .primitive(let prim):
            try prim.encode(to: encoder)
        case .group(let arr):
            try arr.encode(to: encoder)
        }
    }
}

// MARK: - Base Filter (node)

struct SegmentFilter: Codable {
    let id: String
    let connector: SegmentConnector?
    let resource: SegmentFilterResource
}

// MARK: - Segment Model

struct Segment: Codable {
    let id: String
    let title: String
    let description: String?
    let isPrivate: Bool
    let filters: [SegmentFilter]
    let environmentId: String
    let createdAt: Date
    let updatedAt: Date
    let surveys: [String]

    private enum CodingKeys: String, CodingKey {
        case id, title, description, filters, surveys
        case isPrivate = "isPrivate"
        case environmentId, createdAt, updatedAt
    }
}
