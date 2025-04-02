import SwiftUI

/// Presents a survey webview to the window's root
final class PresentSurveyManager {
    static let shared = PresentSurveyManager()
    private init() {
        /*
         This empty initializer prevents external instantiation of the PresentSurveyManager class.
         The class serves as a namespace for the present method, so instance creation is not needed and should be restricted.
        */
    }
    
    /// The view controller that will present the survey window.
    private weak var viewController: UIViewController?
    
    /// Present the webview
    func present(environmentResponse: EnvironmentResponse, id: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if let topVC = self.topViewControllerInVeryWindow() {
                let view = FormbricksView(viewModel: FormbricksViewModel(environmentResponse: environmentResponse, surveyId: id))
                let vc = UIHostingController(rootView: view)
                vc.modalPresentationStyle = .overCurrentContext
                vc.view.backgroundColor = UIColor.clear//UIColor.gray.withAlphaComponent(0.6)
                if #available(iOS 15.0, *) {
                    if let presentationController = vc.presentationController as? UISheetPresentationController {
                        presentationController.detents = [.large()]
                    }
                }
                self.viewController = vc
                topVC.present(vc, animated: true, completion: nil)
            }
        }
    }

    func topViewControllerInVeryWindow(controller: UIViewController? =
                                       UIWindow.key?.rootViewController) -> UIViewController? {
        if let navigationController = controller as? UINavigationController {
            return topViewControllerInVeryWindow(controller: navigationController.visibleViewController)
        }

        if let tabController = controller as? UITabBarController, let selected = tabController.selectedViewController {
            return topViewControllerInVeryWindow(controller: selected)
        }

        if let presented = controller?.presentedViewController {
            return topViewControllerInVeryWindow(controller: presented)
        }

        return controller
    }


    /// Dismiss the webview
    func dismissView() {
        viewController?.dismiss(animated: true)
    }
}

extension UIWindow {
    func dismiss() {
        isHidden = true
        if #available(iOS 13.0, *) {
            windowScene = nil
        }
    }

    static var key: UIWindow? {
        if #available(iOS 13.0, *) {
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow }
        } else {
            return UIApplication.shared.keyWindow
        }
    }
}
