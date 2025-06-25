import XCTest
@testable import FormbricksSDK

final class FormbricksSDKTests: XCTestCase {
    
    let environmentId = "environmentId"
    let appUrl = "appUrl"
    let userId = "6CCCE716-6783-4D0F-8344-9C7DFA43D8F7"
    let surveyID = "cm6ovw6j7000gsf0kduf4oo4i"
    let mockService = MockFormbricksService()
    
    func testFormbricks() throws {
        // Everything should be in the default state before initialization.
        XCTAssertFalse(Formbricks.isInitialized)
        XCTAssertNil(Formbricks.surveyManager)
        XCTAssertNil(Formbricks.userManager)
        XCTAssertEqual(Formbricks.language, "default")
        
        // User manager default state: there is no user yet.
        XCTAssertNil(Formbricks.userManager?.displays)
        XCTAssertNil(Formbricks.userManager?.responses)
        XCTAssertNil(Formbricks.userManager?.segments)
         
        // Use methods before init should have no effect.
        Formbricks.setUserId("userId")
        Formbricks.setLanguage("de")
        Formbricks.setAttributes(["testA" : "testB"])
        Formbricks.setAttribute("test", forKey: "testKey")
        XCTAssertNil(Formbricks.userManager?.userId)
        XCTAssertEqual(Formbricks.language, "default")

        // Setup the SDK using your new instance-based design.
        // This creates new instances for both the UserManager and SurveyManager.
        Formbricks.setup(with: FormbricksConfig.Builder(appUrl: appUrl, environmentId: environmentId)
            .set(attributes: ["a": "b"])
            .add(attribute: "test", forKey: "key")
            .setLogLevel(.debug)
            .build())
       
        // Set up the service dependency on both managers.
        Formbricks.userManager?.service = mockService
        Formbricks.surveyManager?.service = mockService
        
         XCTAssertTrue(Formbricks.isInitialized)
         XCTAssertEqual(Formbricks.appUrl, appUrl)
         XCTAssertEqual(Formbricks.environmentId, environmentId)
         
         // Check error state handling.
         mockService.isErrorResponseNeeded = true
         XCTAssertFalse(Formbricks.surveyManager?.hasApiError ?? false)
         Formbricks.surveyManager?.refreshEnvironmentIfNeeded(force: true)
         XCTAssertTrue(Formbricks.surveyManager?.hasApiError ?? false)

         mockService.isErrorResponseNeeded = false
         Formbricks.surveyManager?.refreshEnvironmentIfNeeded(force: true)
         
         // Authenticate the user.
         Formbricks.setUserId(userId)
         _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: 2.0)
         XCTAssertEqual(Formbricks.userManager?.userId, userId)
         // User refresh timer should be set.
         XCTAssertNotNil(Formbricks.userManager?.syncTimer)
         
         // The environment should be fetched.
         XCTAssertNotNil(Formbricks.surveyManager?.environmentResponse)
         
         // Check if the filter method works properly.
         XCTAssertEqual(Formbricks.surveyManager?.filteredSurveys.count, 1)
         
         // Verify that we’re not showing any survey initially.
         XCTAssertNotNil(Formbricks.surveyManager?.filteredSurveys)
         XCTAssertFalse(Formbricks.surveyManager?.isShowingSurvey ?? false)
         
         // Track an unknown event—survey should not be shown.
         Formbricks.track("unknown_event")
         XCTAssertFalse(Formbricks.surveyManager?.isShowingSurvey ?? false)
         
         // Track a known event—the survey should be shown.
         Formbricks.track("click_demo_button")
         _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: 1.0)
         XCTAssertTrue(Formbricks.surveyManager?.isShowingSurvey ?? false)
         
         // "Dismiss" the webview.
         Formbricks.surveyManager?.dismissSurveyWebView()
         XCTAssertFalse(Formbricks.surveyManager?.isShowingSurvey ?? false)
         
         // Validate display and response.
         Formbricks.surveyManager?.postResponse(surveyId: surveyID)
         Formbricks.surveyManager?.onNewDisplay(surveyId: surveyID)
         XCTAssertEqual(Formbricks.userManager?.responses?.count, 1)
         XCTAssertEqual(Formbricks.userManager?.displays?.count, 1)
         
         // Track a valid event, but survey should not be shown because a response was already submitted.
         Formbricks.track("click_demo_button")
         _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: 1.0)
         XCTAssertFalse(Formbricks.surveyManager?.isShowingSurvey ?? false)
         
         // Validate logout.
         XCTAssertNotNil(Formbricks.userManager?.userId)
         XCTAssertNotNil(Formbricks.userManager?.lastDisplayedAt)
         XCTAssertNotNil(Formbricks.userManager?.responses)
         XCTAssertNotNil(Formbricks.userManager?.displays)
         XCTAssertNotNil(Formbricks.userManager?.segments)
         XCTAssertNotNil(Formbricks.userManager?.expiresAt)
         Formbricks.logout()
         XCTAssertNil(Formbricks.userManager?.userId)
         XCTAssertNil(Formbricks.userManager?.lastDisplayedAt)
         XCTAssertNil(Formbricks.userManager?.responses)
         XCTAssertNil(Formbricks.userManager?.displays)
         XCTAssertNil(Formbricks.userManager?.segments)
         XCTAssertNil(Formbricks.userManager?.expiresAt)
         
         // Clear the responses and verify survey behavior.
         Formbricks.logout()
         Formbricks.surveyManager?.filterSurveys()
         
         Formbricks.track("click_demo_button")
         _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: 1.0)
         XCTAssertTrue(Formbricks.surveyManager?.isShowingSurvey ?? false)
         
        // Test the cleanup
        Formbricks.cleanup()
        XCTAssertNil(Formbricks.userManager)
        XCTAssertNil(Formbricks.surveyManager)
        XCTAssertNil(Formbricks.apiQueue)
        XCTAssertNil(Formbricks.presentSurveyManager)
        XCTAssertFalse(Formbricks.isInitialized)
        XCTAssertNil(Formbricks.appUrl)
        XCTAssertNil(Formbricks.environmentId)
        XCTAssertNil(Formbricks.logger)
    }
    
    func testCleanupWithCompletion() {
        // Setup the SDK
        let config = FormbricksConfig.Builder(appUrl: appUrl, environmentId: environmentId)
            .setLogLevel(.debug)
            .build()
        Formbricks.setup(with: config)
        XCTAssertTrue(Formbricks.isInitialized)
        
        // Set expectation for cleanup completion
        let cleanupExpectation = expectation(description: "Cleanup completed")
        
        Formbricks.cleanup(waitForOperations: true) {
            cleanupExpectation.fulfill()
        }
        
        wait(for: [cleanupExpectation], timeout: 2.0)
        
        // Validate cleanup: all main properties should be nil or false
        XCTAssertNil(Formbricks.userManager)
        XCTAssertNil(Formbricks.surveyManager)
        XCTAssertNil(Formbricks.presentSurveyManager)
        XCTAssertNil(Formbricks.apiQueue)
        XCTAssertFalse(Formbricks.isInitialized)
        XCTAssertNil(Formbricks.appUrl)
        XCTAssertNil(Formbricks.environmentId)
        XCTAssertNil(Formbricks.logger)
    }
}
