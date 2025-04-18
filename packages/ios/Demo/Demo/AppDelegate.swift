import UIKit
import FormbricksSDK

class AppDelegate: NSObject, UIApplicationDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        let config = FormbricksConfig.Builder(appUrl: "[appUrl]", environmentId: "[environmentId]")
            .setLogLevel(.debug)
            .build()
        
        Formbricks.setup(with: config)
        
        
        Formbricks.logout()
        Formbricks.setUserId(UUID().uuidString)
        
        return true
    }

}
