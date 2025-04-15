import Foundation
import Network

/// The main class of the Formbricks SDK. It contains the main methods to interact with the SDK.
@objc(Formbricks) public class Formbricks: NSObject {
    
    static internal var appUrl: String?
    static internal var environmentId: String?
    static internal var language: String = "default"
    static internal var isInitialized: Bool = false
    
    static internal var userManager: UserManager?
    static internal var presentSurveyManager: PresentSurveyManager?
    static internal var surveyManager: SurveyManager?
    static internal var apiQueue = OperationQueue()
    static internal var logger: Logger?
    static internal var service = FormbricksService()
    
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
        
        if (force == true) {
            isInitialized = false
        }
        guard !isInitialized else {
            Formbricks.logger?.error(FormbricksSDKError(type: .sdkIsAlreadyInitialized).message)
            return
        }
        
        self.appUrl = config.appUrl
        self.environmentId = config.environmentId
        self.logger?.logLevel = config.logLevel
        
        userManager = UserManager()
        if let userId = config.userId {
            userManager?.set(userId: userId)
        }
        if let attributes = config.attributes {
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
            Formbricks.logger?.error(FormbricksSDKError(type: .sdkIsNotInitialized).message)
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
            Formbricks.logger?.error(FormbricksSDKError(type: .sdkIsNotInitialized).message)
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
            Formbricks.logger?.error(FormbricksSDKError(type: .sdkIsNotInitialized).message)
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
            Formbricks.logger?.error(FormbricksSDKError(type: .sdkIsNotInitialized).message)
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
            Formbricks.logger?.error(FormbricksSDKError(type: .sdkIsNotInitialized).message)
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
            Formbricks.logger?.error(FormbricksSDKError(type: .sdkIsNotInitialized).message)
            return
        }

        userManager?.logout()
    }
    
    @objc public static func teardown() {
        print("calling teardown")
        userManager?.cleanupUpdateQueue()
        presentSurveyManager?.dismissView()
        presentSurveyManager = nil
        userManager = nil
        surveyManager = nil
        isInitialized = false
        appUrl = nil
        environmentId = nil
        logger = nil
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
