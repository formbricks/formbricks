enum DisplayOptionType: String, Codable {
    case respondMultiple = "respondMultiple"
    case displayOnce = "displayOnce"
    case displayMultiple = "displayMultiple"
    case displaySome = "displaySome"
}

struct SurveyLanguage: Codable {
    let enabled: Bool
    let isDefault: Bool       // must differ from "default" in JSON
    let language: LanguageDetail

    private enum CodingKeys: String, CodingKey {
        case enabled
        case isDefault = "default"
        case language
    }
}

struct SurveyRecaptcha: Codable {
    let enabled: Bool
    let threshold: Double

    private enum CodingKeys: String, CodingKey {
        case enabled
        case threshold
    }

    // Optional: enforce range at decode time
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.enabled = try container.decode(Bool.self, forKey: .enabled)
        let value = try container.decode(Double.self, forKey: .threshold)
        guard (0.1...0.9).contains(value) else {
            throw DecodingError.dataCorruptedError(
                forKey: .threshold,
                in: container,
                debugDescription: "threshold must be between 0.1 and 0.9"
            )
        }
        self.threshold = value
    }
}

struct LanguageDetail: Codable {
    let id: String
    let code: String
    let alias: String?
    let projectId: String
}

struct Survey: Codable {
    let id: String
    let name: String
    let triggers: [Trigger]?
    let recontactDays: Int?
    let displayLimit: Int?
    let delay: Int?
    let displayPercentage: Double?
    let displayOption: DisplayOptionType?
    let segment: Segment?
    let styling: Styling?
    let languages: [SurveyLanguage]?
    let recaptcha: SurveyRecaptcha?
}
