struct Segment: Codable {
    let id: String?
    let createdAt: String?
    let updatedAt: String?
    let title: String?
    let description: String?
    let isPrivate: Bool?
    let filters: [String]?
    let environmentId: String?
    let surveys: [String]?
}
