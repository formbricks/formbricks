import Foundation

public extension Error {
    var message: String {
        if let error = self as? RuntimeError {
            return error.message
        }
        
        if let error = self as? FormbricksAPIClientError {
            return error.errorDescription
        }
        
        if let error = self as? FormbricksAPIError {
            return error.getDetailedErrorMessage()
        }
        
        if let error = self as? FormbricksSDKError {
            return error.errorDescription
        }
        
        return localizedDescription
    }
}
