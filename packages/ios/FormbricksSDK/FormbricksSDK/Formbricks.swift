import Foundation
import Network

/// Formbricks SDK delegate protocol. It contains the main methods to interact with the SDK.
public protocol FormbricksDelegate: AnyObject {
    func onSurveyStarted()
    func onSurveyFinished()
    func onSurveyClosed()
    func onError(_ error: Error)
}

/// The main class of the Formbricks SDK. It contains the main methods to interact with the SDK.
@objc(Formbricks) public class Formbricks: NSObject {
    
    static internal var appUrl: String?
    static internal var environmentId: String?
    static internal var language: String = "default"
    static internal var isInitialized: Bool = false
    
    static internal var userManager: UserManager?
    static internal var presentSurveyManager: PresentSurveyManager?
    static internal var surveyManager: SurveyManager?
    static internal var apiQueue: OperationQueue? = OperationQueue()
    static internal var logger: Logger?
    static internal var service = FormbricksService()
    public static weak var delegate: FormbricksDelegate?
    
    // make this class not instantiatable outside of the SDK
    internal override init() {
        /* 
         This empty initializer prevents external instantiation of the Formbricks class.
         All methods are static and the class serves as a namespace for the SDK,
         so instance creation is not needed and should be restricted.
        */
    }
    
    /**
     Initializes the Formbricks SDK with the given config ``FormbricksConfig``.
     This method is mandatory to be called, and should be only once per application lifecycle.
          
     Example:
     ```swift
     let config = FormbricksConfig.Builder(appUrl: "APP_URL_HERE", environmentId: "TOKEN_HERE")
        .setUserId("USER_ID_HERE")
        .setLogLevel(.debug)
        .build()
      
     Formbricks.setup(with: config)
     ```
     */
    @objc public static func setup(with config: FormbricksConfig, force: Bool = false) {
        logger = Logger()
        apiQueue = OperationQueue()
        
        if force {
            isInitialized = false
        }
        
        guard !isInitialized else {
            let error = FormbricksSDKError(type: .sdkIsAlreadyInitialized)
            delegate?.onError(error)
            Formbricks.logger?.error(error.message)
            return
        }
        
        self.appUrl = config.appUrl
        self.environmentId = config.environmentId
        self.logger?.logLevel = config.logLevel
        
        userManager = UserManager()
        if let userId = config.userId {
            userManager?.set(userId: userId)
        }
        if let attributes = config.attributes, !attributes.isEmpty {
            userManager?.set(attributes: attributes)
        }
        if let language = config.attributes?["language"] {
            userManager?.set(language: language)
            self.language = language
        }
    
        presentSurveyManager = PresentSurveyManager()
        surveyManager = SurveyManager.create(userManager: userManager!, presentSurveyManager: presentSurveyManager!)
        userManager?.surveyManager = surveyManager
        
        surveyManager?.refreshEnvironmentIfNeeded(force: force)
        userManager?.syncUserStateIfNeeded()
        
        self.isInitialized = true
    }
    
    /**
     Sets the user id for the current user with the given `String`.
     The SDK must be initialized before calling this method.
          
     Example:
     ```swift
     Formbricks.setUserId("USER_ID_HERE")
     ```
     */
    @objc public static func setUserId(_ userId: String) {
        guard Formbricks.isInitialized else {
            let error = FormbricksSDKError(type: .sdkIsNotInitialized)
                        delegate?.onError(error)
                        Formbricks.logger?.error(error.message)
            return
        }
        
        if let existing = userManager?.userId, !existing.isEmpty {
            logger?.error("A userId is already set (\"\(existing)\") – please call Formbricks.logout() before setting a new one.")
            return
        }
        
        userManager?.set(userId: userId)
    }
    
    /**
     Adds an attribute for the current user with the given `String` value and `String` key.
     The SDK must be initialized before calling this method.
          
     Example:
     ```swift
     Formbricks.setAttribute("ATTRIBUTE", forKey: "KEY")
     ```
     */
    @objc public static func setAttribute(_ attribute: String, forKey key: String) {
        guard Formbricks.isInitialized else {
            let error = FormbricksSDKError(type: .sdkIsNotInitialized)
            delegate?.onError(error)
            Formbricks.logger?.error(error.message)
            return
        }
        
        userManager?.add(attribute: attribute, forKey: key)
    }
    
    /**
     Sets the user attributes for the current user with the given `Dictionary` of `String` values and `String` keys.
     The SDK must be initialized before calling this method.
          
     Example:
     ```swift
     Formbricks.setAttributes(["KEY", "ATTRIBUTE"])
     ```
     */
    @objc public static func setAttributes(_ attributes: [String : String]) {
        guard Formbricks.isInitialized else {
            let error = FormbricksSDKError(type: .sdkIsNotInitialized)
            delegate?.onError(error)
            Formbricks.logger?.error(error.message)
            return
        }
        
        userManager?.set(attributes: attributes)
    }
    
    /**
     Sets the language for the current user with the given `String`.
     The SDK must be initialized before calling this method.
          
     Example:
     ```swift
     Formbricks.setLanguage("de")
     ```
     */
    @objc public static func setLanguage(_ language: String) {
        guard Formbricks.isInitialized else {
            let error = FormbricksSDKError(type: .sdkIsNotInitialized)
            delegate?.onError(error)
            Formbricks.logger?.error(error.message)
            return
        }
        
        if (Formbricks.language == language) {
            return
        }
        
        Formbricks.language = language
        userManager?.set(language: language)
    }
    
    /**
     Tracks an action with the given `String`. The SDK will process the action and it will present the survey if any of them can be triggered.
     The SDK must be initialized before calling this method.
          
     Example:
     ```swift
     Formbricks.track("button_clicked")
     ```
     */
    @objc public static func track(_ action: String) {
        guard Formbricks.isInitialized else {
            let error = FormbricksSDKError(type: .sdkIsNotInitialized)
            delegate?.onError(error)
            Formbricks.logger?.error(error.message)
            return
        }
        
        Formbricks.isInternetAvailabile { available in
            if available {
                surveyManager?.track(action)
            } else {
                Formbricks.logger?.warning(FormbricksSDKError.init(type: .networkError).message)
            }
        }
        
    }
    
    /**
     Logs out the current user. This will clear the user attributes and the user id.
     The SDK must be initialized before calling this method.
          
     Example:
     ```swift
     Formbricks.logout()
     ```
     */
    @objc public static func logout() {
        guard Formbricks.isInitialized else {
            let error = FormbricksSDKError(type: .sdkIsNotInitialized)
            delegate?.onError(error)
            Formbricks.logger?.error(error.message)
            return
        }

        userManager?.logout()
    }
    
    /**
    Cleans up the SDK. This will clear the user attributes, the user id and the environment state.
    The SDK must be initialized before calling this method.
    If `waitForOperations` is set to `true`, it will wait for all operations to finish before cleaning up.
    If `waitForOperations` is set to `false`, it will clean up immediately.
    You can also provide a completion block that will be called when the cleanup is finished.

    Example:
    ```swift
    Formbricks.cleanup()

    Formbricks.cleanup(waitForOperations: true) {
        // Cleanup completed
    }
    ```
     */
    
    @objc public static func cleanup(waitForOperations: Bool = false, completion: (() -> Void)? = nil) {
        if waitForOperations, let queue = apiQueue {
            DispatchQueue.global(qos: .background).async {
                queue.waitUntilAllOperationsAreFinished()
                performCleanup()
                DispatchQueue.main.async {
                    completion?()
                }
            }
        } else {
            apiQueue?.cancelAllOperations()
            performCleanup()
            completion?()
        }
    }

    private static func performCleanup() {
        userManager?.logout()
        userManager?.cleanupUpdateQueue()
        presentSurveyManager?.dismissView()
        presentSurveyManager = nil
        userManager = nil
        surveyManager = nil
        apiQueue = nil
        isInitialized = false
        appUrl = nil
        environmentId = nil
        logger = nil
        language = "default"
    }
}

// MARK: - Check the network connection -
private extension Formbricks {
    static func isInternetAvailabile(completion: @escaping (Bool) -> Void) {
        let monitor = NWPathMonitor()
        let queue = DispatchQueue.global(qos: .background)
        
        monitor.pathUpdateHandler = { path in
            completion(path.status == .satisfied)
            monitor.cancel()
        }
        
        monitor.start(queue: queue)
    }
}
