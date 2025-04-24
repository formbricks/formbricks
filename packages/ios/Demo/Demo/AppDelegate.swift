import UIKit
import FormbricksSDK

class AppDelegate: NSObject, UIApplicationDelegate, FormbricksDelegate {
    
    func application(_ application: UIApplication, 
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        Formbricks.delegate = self
        return true
    }
    
    // MARK: - FormbricksDelegate

      func onSurveyStarted() {
        print("from the delegate: survey started")
      }

      func onSurveyFinished() {
        print("survey finished")
      }

      func onSurveyClosed() {
        print("survey closed")
      }

      func onError(_ error: Error) {
        print("survey error:", error.localizedDescription)
      }
}
