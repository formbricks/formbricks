enum DisplayOptionType: String, Codable {
    case respondMultiple = "respondMultiple"
    case displayOnce = "displayOnce"
    case displayMultiple = "displayMultiple"
    case displaySome = "displaySome"
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
}

