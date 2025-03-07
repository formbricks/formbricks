struct FormbricksAPIError: Codable, LocalizedError {
    let code: String
    let message: String
    let details: [String:String]?
}

extension FormbricksAPIError {
    func getDetailedErrorMessage() -> String {
        if let errorDetails = details?.map({ "\($0.key): \($0.value)" }) {
            return "\(message)\n\(errorDetails)"
        } else {
            return message
        }
    }
}
