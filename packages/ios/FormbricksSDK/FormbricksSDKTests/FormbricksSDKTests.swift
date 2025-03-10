//
//  FormbricksSDKTests.swift
//  FormbricksSDKTests
//
//  Created by Peter Pesti-Varga on 2025. 02. 03..
//

import XCTest
@testable import FormbricksSDK

final class FormbricksSDKTests: XCTestCase {
    
    let environmentId = "environmentId"
    let appUrl = "appUrl"
    let userId = "6CCCE716-6783-4D0F-8344-9C7DFA43D8F7"
    let surveyID = "cm6ovw6j7000gsf0kduf4oo4i"
    let mockService = MockFormbricksService()

    override func setUpWithError() throws {
        UserManager.shared.logout()
        SurveyManager.shared.service = mockService
        UserManager.shared.service = mockService
        SurveyManager.shared.environmentResponse = nil
    }
    
    func testFormbricks() throws {
        // Everything should be in the default state
        XCTAssertFalse(Formbricks.isInitialized)
        XCTAssertEqual(SurveyManager.shared.filteredSurveys.count, 0)
        XCTAssertFalse(SurveyManager.shared.isShowingSurvey)
        XCTAssertNil(SurveyManager.shared.environmentResponse)
        XCTAssertNil(UserManager.shared.syncTimer)
        XCTAssertNil(UserManager.shared.userId)
        XCTAssertEqual(Formbricks.language, "default")
        
        // Use methods before init should have no effect
        Formbricks.setUserId("userId")
        Formbricks.setLanguage("de")
        Formbricks.setAttributes(["testA" : "testB"])
        Formbricks.setAttribute("test", forKey: "testKey")
        XCTAssertNil(UserManager.shared.userId)
        XCTAssertEqual(Formbricks.language, "default")
        
        // Call the setup and initialize the SDK
        Formbricks.setup(with:
                            FormbricksConfig.Builder(appUrl: appUrl, environmentId: environmentId)
                                .set(attributes: ["a":"b"])
                                .add(attribute: "test", forKey: "key")
                                .setLogLevel(.debug)
                                .build()
        )
        // Should be ignored, becuase we don't have user ID yet
        Formbricks.setAttributes(["testA" : "testB"])
        Formbricks.setAttribute("test", forKey: "testKey")
        XCTAssertNil(UserManager.shared.userId)
        
        // Verify the base variables are set properly
        XCTAssertTrue(Formbricks.isInitialized)
        XCTAssertEqual(Formbricks.appUrl, appUrl)
        XCTAssertEqual(Formbricks.environmentId, environmentId)
        
        // User manager default state. There is no user yet.
        XCTAssertNil(FormbricksSDK.UserManager.shared.displays)
        XCTAssertNil(FormbricksSDK.UserManager.shared.responses)
        XCTAssertNil(FormbricksSDK.UserManager.shared.segments)
        
        // Check error state handling
        mockService.isErrorResponseNeeded = true
        XCTAssertFalse(SurveyManager.shared.hasApiError)
        SurveyManager.shared.refreshEnvironmentIfNeeded(force: true)
        XCTAssertTrue(SurveyManager.shared.hasApiError)
        mockService.isErrorResponseNeeded = false
        
        // Authenticate the user
        Formbricks.setUserId(userId)
        _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: 2.0)
        XCTAssertEqual(UserManager.shared.userId, userId)
        // User refresh timer should be set
        XCTAssertNotNil(UserManager.shared.syncTimer)
        
        // The environment should be fetched already
        XCTAssertNotNil(SurveyManager.shared.environmentResponse)
        
        // Check if the filter method works properly
        XCTAssertEqual(SurveyManager.shared.filteredSurveys.count, 1)
        
        // Make sure we don't show any survey
        XCTAssertNotNil(SurveyManager.shared.filteredSurveys)
        XCTAssertFalse(SurveyManager.shared.isShowingSurvey)
        
        // Track an unknown event, shouldn't show the survey
        Formbricks.track("unknown_event")
        XCTAssertFalse(SurveyManager.shared.isShowingSurvey)
        
        // Track a known event, thus, the survey should be shown.
        Formbricks.track("click_demo_button")
        _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: 1.0)
        XCTAssertTrue(SurveyManager.shared.isShowingSurvey)
        
        // "Dismiss" the webview
        SurveyManager.shared.dismissSurveyWebView()
        XCTAssertFalse(SurveyManager.shared.isShowingSurvey)
        
        // Validate display and response
        SurveyManager.shared.postResponse(surveyId: surveyID)
        SurveyManager.shared.onNewDisplay(surveyId: surveyID)
        XCTAssertEqual(UserManager.shared.responses?.count, 1)
        XCTAssertEqual(UserManager.shared.displays?.count, 1)
        
        // Track a valid event, but the survey should not shown, because we already gave a response.
        Formbricks.track("click_demo_button")
        _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: 1.0)
        XCTAssertFalse(SurveyManager.shared.isShowingSurvey)
        
        // Validate logout
        XCTAssertNotNil(UserManager.shared.userId)
        XCTAssertNotNil(UserManager.shared.lastDisplayedAt)
        XCTAssertNotNil(UserManager.shared.responses)
        XCTAssertNotNil(UserManager.shared.displays)
        XCTAssertNotNil(UserManager.shared.segments)
        XCTAssertNotNil(UserManager.shared.expiresAt)
        Formbricks.logout()
        XCTAssertNil(UserManager.shared.userId)
        XCTAssertNil(UserManager.shared.lastDisplayedAt)
        XCTAssertNil(UserManager.shared.responses)
        XCTAssertNil(UserManager.shared.displays)
        XCTAssertNil(UserManager.shared.segments)
        XCTAssertNil(UserManager.shared.expiresAt)
        
        // Clear the responses
        Formbricks.logout()
        SurveyManager.shared.filterSurveys()
        
        Formbricks.track("click_demo_button")
        _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: 1.0)
        XCTAssertTrue(SurveyManager.shared.isShowingSurvey)
        
        SurveyManager.shared.delayedDismiss()
        XCTAssertTrue(SurveyManager.shared.isShowingSurvey)
        _ = XCTWaiter.wait(for: [expectation(description: "Wait for a seconds")], timeout: Double(Config.Environment.closingTimeoutInSeconds))
        XCTAssertFalse(SurveyManager.shared.isShowingSurvey)
    }
    
}
