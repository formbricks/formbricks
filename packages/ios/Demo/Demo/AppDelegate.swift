import UIKit
import FormbricksSDK

class AppDelegate: NSObject, UIApplicationDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        setupFormbrick()
        return true
    }
    
    func setupFormbrick() {
        let config = FormbricksConfig.Builder(appUrl: "[appUrl]", environmentId: "[environmentId]")
            .setLogLevel(.debug)
            .build()
        
        Formbricks.delegate = self
        
        Formbricks.setup(with: config,
                         force: true,
                         certData: loadCertData())
        
        Formbricks.logout()
        Formbricks.setUserId(UUID().uuidString)
    }
    
    func loadCertData() -> Data? {
        guard let certificatePath = Bundle.main.path(forResource: "example.com", ofType: "der") else {
            return nil
        }
        
        return try? Data(contentsOf: URL(fileURLWithPath: certificatePath))
    }
}

extension AppDelegate: FormbricksDelegate {
    func onResponseCreated() {
        
    }
    
    func onSurveyDisplayed() {
        
    }
    
    func onSuccess(_ successAction: FormbricksSDK.SuccessAction) {
//        if (successAction == .onFinishedSetup) {
//            Formbricks.track("[action_key]", hiddenFields: ["key": "value"])
//        }
    }
    
    func onSurveyStarted() {
        print("survey started")
    }
    
    func onSurveyFinished() {
        print("survey finished")
    }
    
    func onSurveyClosed() {
        print("survey closed")
    }
    
    func onError(_ error: any Error) {
        print("survey error")
        print(error.message)
        if let error = error as? FormbricksSDKError {
            print(error.message)
        }
    }
    
}
