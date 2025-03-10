import UIKit

extension UIApplication {
    static var safeShared: UIApplication? {
        return UIApplication.value(forKeyPath: "sharedApplication") as? UIApplication
    }
    
    static var safeKeyWindow: UIWindow? {
        return safeShared?.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first
        }
}
