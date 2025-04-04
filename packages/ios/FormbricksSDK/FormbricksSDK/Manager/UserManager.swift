import Foundation

/// Store and manage user state and sync with the server when needed.
final class UserManager {
    static let shared = UserManager()
    private init() { }
    
    private static let userIdKey = "userIdKey"
    private static let contactIdKey = "contactIdKey"
    private static let segmentsKey = "segmentsKey"
    private static let displaysKey = "displaysKey"
    private static let responsesKey = "responsesKey"
    private static let lastDisplayedAtKey = "lastDisplayedAtKey"
    private static let expiresAtKey = "expiresAtKey"
    
    internal var service = FormbricksService()
    
    private var backingUserId: String?
    private var backingContactId: String?
    private var backingSegments: [String]?
    private var backingDisplays: [Display]?
    private var backingResponses: [String]?
    private var backingLastDisplayedAt: Date?
    private var backingExpiresAt: Date?
    
    internal var syncTimer: Timer?
    
    /// Starts an update queue with the given user id.
    func set(userId: String) {
        UpdateQueue.current.set(userId: userId)
    }
    
    /// Starts an update queue with the given attribute.
    func add(attribute: String, forKey key: String) {
        UpdateQueue.current.add(attribute: attribute, forKey: key)
    }
    
    /// Starts an update queue with the given attributes.
    func set(attributes: [String: String]) {
        UpdateQueue.current.set(attributes: attributes)
    }
    
    /// Starts an update queue with the given language..
    func set(language: String) {
        UpdateQueue.current.set(language: language)
    }
    
    /// Saves `surveyId` to the `displays` property and the current date to the `lastDisplayedAt` property.
    func onDisplay(surveyId: String) {
        let lastDisplayedAt = Date()
        var newDisplays = displays ?? []
        newDisplays.append(Display(surveyId: surveyId, createdAt: DateFormatter.isoFormatter.string(from: lastDisplayedAt)))
        displays = newDisplays
        self.lastDisplayedAt = lastDisplayedAt
        SurveyManager.shared.filterSurveys()
    }
    
    /// Saves `surveyId` to the `responses` property.
    func onResponse(surveyId: String) {
        var newResponses = responses ?? []
        newResponses.append(surveyId)
        responses = newResponses
        SurveyManager.shared.filterSurveys()
    }
    
    /// Syncs the user state with the server if the user id is set and the expiration date has passed.
    func syncUserStateIfNeeded() {
        guard let id = userId, let expiresAt = self.expiresAt, expiresAt.timeIntervalSinceNow <= 0 else {
            backingSegments = []
            backingDisplays = []
            backingResponses = []
            return
        }
        
        syncUser(withId: id)
    }

    /// Syncs the user state with the server, calls the `SurveyManager.shared.filterSurveys()` method and starts the sync timer.
    func syncUser(withId id: String, attributes: [String: String]? = nil) {
        service.postUser(id: id, attributes: attributes) { [weak self] result in
            switch result {
            case .success(let userResponse):
                self?.userId = userResponse.data.state?.data?.userId
                self?.contactId = userResponse.data.state?.data?.contactId
                self?.segments = userResponse.data.state?.data?.segments
                self?.displays = userResponse.data.state?.data?.displays
                self?.responses = userResponse.data.state?.data?.responses
                self?.lastDisplayedAt = userResponse.data.state?.data?.lastDisplayAt
                self?.expiresAt = userResponse.data.state?.expiresAt
                UpdateQueue.current.reset()
                SurveyManager.shared.filterSurveys()
                self?.startSyncTimer()
            case .failure(let error):
                Formbricks.delegate?.onError(error)
                Formbricks.logger.error(error)
            }
        }
    }
    
    /// Logs out the user and clears the user state.
    func logout() {
        UserDefaults.standard.removeObject(forKey: UserManager.userIdKey)
        UserDefaults.standard.removeObject(forKey: UserManager.segmentsKey)
        UserDefaults.standard.removeObject(forKey: UserManager.displaysKey)
        UserDefaults.standard.removeObject(forKey: UserManager.responsesKey)
        UserDefaults.standard.removeObject(forKey: UserManager.lastDisplayedAtKey)
        UserDefaults.standard.removeObject(forKey: UserManager.expiresAtKey)
        backingUserId = nil
        backingSegments = nil
        backingDisplays = nil
        backingResponses = nil
        backingLastDisplayedAt = nil
        backingExpiresAt = nil
        UpdateQueue.current.reset()
    }
}

// MARK: - Timer -
private extension UserManager {
    func startSyncTimer() {
        guard let expiresAt = expiresAt, let id = userId else { return }
        syncTimer?.invalidate()
        syncTimer = Timer.scheduledTimer(withTimeInterval: expiresAt.timeIntervalSinceNow, repeats: false) { [weak self] _ in
            self?.syncUser(withId: id)
        }
    }

}

// MARK: - Getters -
extension UserManager {
    private(set) var userId: String? {
        get {
            backingUserId = backingUserId ?? UserDefaults.standard.string(forKey: UserManager.userIdKey)
            return backingUserId
        } set {
            UserDefaults.standard.set(newValue, forKey: UserManager.userIdKey)
            backingUserId = newValue
        }
    }
    private(set) var contactId: String? {
        get {
            backingContactId = backingContactId ?? UserDefaults.standard.string(forKey: UserManager.contactIdKey)
            return backingContactId
        } set {
            UserDefaults.standard.set(newValue, forKey: UserManager.contactIdKey)
            backingContactId = newValue
        }
    }
    private(set) var segments: [String]? {
        get {
            backingSegments = backingSegments ?? UserDefaults.standard.stringArray(forKey: UserManager.segmentsKey)
            return backingSegments
        } set {
            UserDefaults.standard.set(newValue, forKey: UserManager.segmentsKey)
            backingSegments = newValue
        }
    }
    private(set) var displays: [Display]? {
        get {
            guard let jsonData = UserDefaults.standard.string(forKey: UserManager.displaysKey)?.data(using: .utf8) else {
                return nil
            }
            let decodedDisplays = try? JSONDecoder().decode([Display].self, from: jsonData)
            backingDisplays = decodedDisplays
            return backingDisplays
        } set {
            guard let jsonData = try? JSONEncoder().encode(newValue), let jsonString = String(data: jsonData, encoding: .utf8) else { return }
            UserDefaults.standard.set(jsonString, forKey: UserManager.displaysKey)
            backingDisplays = newValue
        }
    }
    private(set) var responses: [String]? {
        get {
            backingResponses = backingResponses ?? UserDefaults.standard.stringArray(forKey: UserManager.responsesKey)
            return backingResponses
        } set {
            UserDefaults.standard.set(newValue, forKey: UserManager.responsesKey)
            backingResponses = newValue
        }
    }
    private(set) var lastDisplayedAt: Date? {
        get {
            if let backingLastDisplayedAt = backingLastDisplayedAt {
                return backingLastDisplayedAt
            } else {
                let timeInterval = UserDefaults.standard.double(forKey: UserManager.lastDisplayedAtKey)
                return timeInterval > 0 ? Date(timeIntervalSince1970: timeInterval) : nil
            }
        } set {
            UserDefaults.standard.set(newValue?.timeIntervalSince1970, forKey: UserManager.lastDisplayedAtKey)
            backingLastDisplayedAt = newValue
        }
    }
    private(set) var expiresAt: Date? {
        get {
            if let backingExpiresAt = backingExpiresAt {
                return backingExpiresAt
            } else {
                let timeInterval = UserDefaults.standard.double(forKey: UserManager.expiresAtKey)
                return timeInterval > 0 ? Date(timeIntervalSince1970: timeInterval) : nil
            }
        } set {
            UserDefaults.standard.set(newValue?.timeIntervalSince1970, forKey: UserManager.expiresAtKey)
            backingExpiresAt = newValue
        }
    }
}
