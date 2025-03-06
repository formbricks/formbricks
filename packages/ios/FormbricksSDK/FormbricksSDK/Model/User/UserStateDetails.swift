struct UserStateDetails: Codable {
    let userId: String
    let segments: [String]?
    let displays: [Display]?
    let responses: [String]?
    let lastDisplayAt: Date?
}
