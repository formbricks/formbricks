import Foundation

/// Update queue. This class is used to queue updates to the user.
/// The given properties will be sent to the backend and updated in the user object when the debounce interval is reached.
final class UpdateQueue {
    
    private static var debounceInterval: TimeInterval = 0.5
    static var current = UpdateQueue()
    
    private let semaphore = DispatchSemaphore(value: 1)
    private var userId: String?
    private var attributes: [String : String]?
    private var language: String?
    private var timer: Timer?
    
    func set(userId: String) {
        semaphore.wait()
        self.userId = userId
        startDebounceTimer()
    }
    
    func set(attributes: [String : String]) {
        semaphore.wait()
        self.attributes = attributes
        startDebounceTimer()
    }
    
    func add(attribute: String, forKey key: String) {
        semaphore.wait()
        if var attr = self.attributes {
            attr[key] = attribute
            self.attributes = attr
        } else {
            self.attributes = [key: attribute]
        }
        startDebounceTimer()
    }
    
    func set(language: String) {
        semaphore.wait()
        add(attribute: "language", forKey: language)
        startDebounceTimer()
    }
    
    func reset() {
        userId = nil
        attributes = nil
        language = nil
    }
}

private extension UpdateQueue {
    func startDebounceTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(timeInterval: UpdateQueue.debounceInterval, target: self, selector: #selector(commit), userInfo: nil, repeats: false)
        semaphore.signal()
    }
    
    @objc func commit() {
        guard let userId = userId else {
            let error = FormbricksSDKError(type: .userIdIsNotSetYet)
            Formbricks.delegate?.onError(error)
            Formbricks.logger.error(error.message)
            return
        }
        
        Formbricks.logger.debug("UpdateQueue - commit() called on UpdateQueue with \(userId) and \(attributes ?? [:])")
        UserManager.shared.syncUser(withId: userId, attributes: attributes)
    }
}
