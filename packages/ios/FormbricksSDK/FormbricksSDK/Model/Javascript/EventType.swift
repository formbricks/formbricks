enum EventType: String, Codable {
    case onClose = "onClose"
    case onFinished = "onFinished"
    case onDisplayCreated = "onDisplayCreated"
    case onResponseCreated = "onResponseCreated"
    case onOpenExternalURL = "onOpenExternalURL"
    case onSurveyLibraryLoadError = "onSurveyLibraryLoadError"
}
