struct RuntimeError: Error, Codable {
    let message: String
    
    var localizedDescription: String {
        return message
    }
}
