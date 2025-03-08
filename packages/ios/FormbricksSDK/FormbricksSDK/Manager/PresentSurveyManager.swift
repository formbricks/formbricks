import SwiftUI

/// Presents a survey webview to the window's root
final class PresentSurveyManager {
    static let shared = PresentSurveyManager()
    private init() { }
    
    /// The view controller that will present the survey window.
    private weak var viewController: UIViewController?
    
    /// Present the webview
    func present(environmentResponse: EnvironmentResponse, id: String) {
        DispatchQueue.main.async {
            if let window = UIApplication.safeKeyWindow {
                let view = FormbricksView(viewModel: FormbricksViewModel(environmentResponse: environmentResponse, surveyId: id))
                let vc = UIHostingController(rootView: view)
                vc.modalPresentationStyle = .overCurrentContext
                vc.view.backgroundColor = UIColor.gray.withAlphaComponent(0.6)
                if let presentationController = vc.presentationController as? UISheetPresentationController {
                    presentationController.detents = [.large()]
                }
                self.viewController = vc
                window.rootViewController?.present(vc, animated: true, completion: nil)
            }
        }
    }
    
    /// Dismiss the webview
    func dismissView() {
        viewController?.dismiss(animated: true)
    }
    
    
}
