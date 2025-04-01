import UIKit
import FormbricksSDK

class AppDelegate: NSObject, UIApplicationDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        let config = FormbricksConfig.Builder(appUrl: "[appUrl]", environmentId: "[environmentId]")
            .setLogLevel(.debug)
            .build()
        
        Formbricks.delegate = self
        
        Formbricks.setup(with: config)
        
        Formbricks.logout()
        Formbricks.setUserId(UUID().uuidString)
        
        return true
    }

}

extension AppDelegate: FormbricksDelegate {
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
        if let error = error as? FormbricksSDKError {
            print(error.message)
        }
    }
    
}
