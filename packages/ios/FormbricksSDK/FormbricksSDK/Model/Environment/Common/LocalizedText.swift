struct LocalizedText: Codable {
    let defaultText: String?
    
    enum CodingKeys: String, CodingKey {
        case defaultText = "default"
    }
}
