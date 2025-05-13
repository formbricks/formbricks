import Foundation

protocol UserManagerSyncable: AnyObject {
    func syncUser(withId id: String, attributes: [String: String]?)
}

/// Update queue. This class is used to queue updates to the user.
/// The given properties will be sent to the backend and updated in the user object when the debounce interval is reached.
final class UpdateQueue {
    
    private static var debounceInterval: TimeInterval = 0.5
    
    private let syncQueue = DispatchQueue(label: "com.formbricks.updateQueue")
    private var userId: String?
    private var attributes: [String : String]?
    private var language: String?
    private var timer: Timer?
    
    private weak var userManager: UserManagerSyncable?

    init(userManager: UserManagerSyncable) {
        self.userManager = userManager
    }
    
    func set(userId: String) {
        syncQueue.sync {
            self.userId = userId
            startDebounceTimer()
        }
    }
    
    func set(attributes: [String : String]) {
        syncQueue.sync {
            self.attributes = attributes
            startDebounceTimer()
        }
    }
    
    func add(attribute: String, forKey key: String) {
        syncQueue.sync {
           if var attr = self.attributes {
               attr[key] = attribute
               self.attributes = attr
           } else {
               self.attributes = [key: attribute]
           }
           startDebounceTimer()
       }
    }
    
    func set(language: String) {
        syncQueue.sync {
            self.language = language
            
            // Check if we have an effective userId
            let effectiveUserId = self.userId ?? Formbricks.userManager?.userId
            
            if effectiveUserId != nil {
                // If we have a userId, set attributes
                self.attributes = ["language": language]
            } else {
                // If no userId, just update locally without API call
                Formbricks.logger?.debug("UpdateQueue - updating language locally: \(language)")
                return
            }
            
            startDebounceTimer()
        }
    }
    
    func reset() {
        syncQueue.sync {
            userId = nil
            attributes = nil
            language = nil
        }
    }
    
    deinit {
        Formbricks.logger?.debug("Deinitializing \(self)")
    }
}

private extension UpdateQueue {
    func startDebounceTimer() {
        timer?.invalidate()
        timer = nil
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.timer = Timer.scheduledTimer(timeInterval: UpdateQueue.debounceInterval,
                                              target: self,
                                              selector: #selector(self.commit),
                                              userInfo: nil,
                                              repeats: false)
        }
    }
    
    @objc func commit() {
        let effectiveUserId: String? = self.userId ?? Formbricks.userManager?.userId ?? nil
    
        guard let userId = effectiveUserId else {
            let error = FormbricksSDKError(type: .userIdIsNotSetYet)
            Formbricks.logger?.error(error.message)
            return
        }
        
        Formbricks.logger?.debug("UpdateQueue - commit() called on UpdateQueue with \(userId) and \(attributes ?? [:])")
        userManager?.syncUser(withId: userId, attributes: attributes)
    }
}

// Add a function to to stop the timer for cleanup
extension UpdateQueue {
    func cleanup() {
        syncQueue.sync {
            timer?.invalidate()
            timer = nil
            userId = nil
            attributes = nil
            language = nil
        }
    }
}
