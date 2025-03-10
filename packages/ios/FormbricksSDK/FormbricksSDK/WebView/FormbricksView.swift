import SwiftUI

/// SwiftUI view for the Formbricks survey webview.
struct FormbricksView: View {
    @ObservedObject var viewModel: FormbricksViewModel
    
    var body: some View {
        if let htmlString = viewModel.htmlString {
            SurveyWebView(surveyId: viewModel.surveyId, htmlString: htmlString)
        }
    }
}
