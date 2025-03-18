import Foundation

struct UserStateDetails: Codable {
    let userId: String
    let contactId: String
    let segments: [String]?
    let displays: [Display]?
    let responses: [String]?
    let lastDisplayAt: Date?
}
