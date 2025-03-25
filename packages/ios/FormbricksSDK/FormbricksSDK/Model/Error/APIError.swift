import Foundation

enum FormbricksAPIErrorType: Int {
    case invalidResponse
    case responseError
    
    var description: String {
        switch self {
        case .invalidResponse:
            return "Unknown error. Please check your connection and try again."
        case .responseError:
            return "Response error."
        }
    }
}

final class FormbricksAPIClientError: LocalizedError {
    let type: FormbricksAPIErrorType
    let statusCodeInt: Int?
    let statusCode: HTTPStatusCode?
    
    var errorDescription: String
    
    init(type: FormbricksAPIErrorType, statusCode: Int? = nil) {
        self.type = type
        if let statusCode = statusCode {
            self.statusCodeInt = statusCode
            self.statusCode = HTTPStatusCode(rawValue: statusCode)
        } else {
            self.statusCodeInt = nil
            self.statusCode = nil
        }
        self.errorDescription = type.description
    }
}
