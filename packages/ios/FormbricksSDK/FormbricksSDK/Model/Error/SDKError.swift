import Foundation

public enum FormbricksSDKErrorType: Int {
    case sdkIsNotInitialized
    case sdkIsAlreadyInitialized
    case invalidAppUrl
    case unableToRefreshEnvironment
    case unableToPersistEnvironment
    case unableToRetrieveEnvironment
    case invalidJavascriptMessage
    case surveyLibraryLoadError
    case unableToRetrieveUser
    case unableToPersistUser
    case userIdIsNotSetYet
    case invalidDisplayOption
    case surveyNotFoundError
    case surveyNotDisplayableError
    case networkError
    
    var description: String {
        switch self {
        case .sdkIsNotInitialized:
            return "The SDK is not initialized"
        case .sdkIsAlreadyInitialized:
            return "The SDK is already initialized"
        case .invalidAppUrl:
            return "Invalid App URL"
        case .unableToRefreshEnvironment:
            return "Unable to refresh the environment object. Will try again in \(Config.Environment.refreshStateOnErrorTimeoutInMinutes) minutes."
        case .unableToPersistEnvironment:
            return "Unable to persist the environment object."
        case .unableToRetrieveEnvironment:
            return "Unable to retrieve the environment object."
        case .invalidJavascriptMessage:
            return "Invalid Javascript Message"
        case .unableToRetrieveUser:
            return "Unable to retrieve the user object."
        case .unableToPersistUser:
            return "Unable to persist the user object."
        case .userIdIsNotSetYet:
            return "Unable to commit user attributes because userId is not set."
        case .invalidDisplayOption:
            return "Invalid Display Option"
        case .surveyNotFoundError:
            return "Survey Not Found"
        case .surveyLibraryLoadError:
            return "Survey Library Load Error"
        case .surveyNotDisplayableError:
            return "Survey Not Displayable"
        case .networkError:
            return "No internet connection"
        }
    }
}

public final class FormbricksSDKError:  LocalizedError {
    public let type: FormbricksSDKErrorType
    public var errorDescription: String
    
    init(type: FormbricksSDKErrorType) {
        self.type = type
        self.errorDescription = type.description
    }
}
