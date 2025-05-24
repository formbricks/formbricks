import SwiftUI

/// The SurveyManager is responsible for managing the surveys that are displayed to the user.
/// Filtering surveys based on the user's segments, responses, and displays.
final class SurveyManager {
    private let userManager: UserManager
    private let presentSurveyManager: PresentSurveyManager

    private init(userManager: UserManager, presentSurveyManager: PresentSurveyManager) {
        self.userManager = userManager
        self.presentSurveyManager = presentSurveyManager
    }

    static func create(userManager: UserManager, presentSurveyManager: PresentSurveyManager) -> SurveyManager {
        return SurveyManager(userManager: userManager, presentSurveyManager: presentSurveyManager)
    }

    private static let environmentResponseObjectKey = "environmentResponseObjectKey"
    internal var service = FormbricksService()
    private var backingEnvironmentResponse: EnvironmentResponse?
    /// Stores the surveys that are filtered based on the defined criteria, such as recontact days, display options etc.
    internal  private(set) var filteredSurveys: [Survey] = []
    /// Stores is a survey is being shown or the show in delayed
    internal private(set) var isShowingSurvey: Bool = false
    /// Store error state
    internal private(set) var hasApiError: Bool = false

    /// Fills up the `filteredSurveys` array
    func filterSurveys() {
        guard let environment = environmentResponse else { return }
        guard let surveys = environment.data.data.surveys else { return }

        let displays = userManager.displays ?? []
        let responses = userManager.responses ?? []
        let segments = userManager.segments ?? []

        filteredSurveys = filterSurveysBasedOnDisplayType(surveys, displays: displays, responses: responses)
        filteredSurveys = filterSurveysBasedOnRecontactDays(filteredSurveys, defaultRecontactDays: environment.data.data.project.recontactDays)

        // If we have a user, we do more filtering
        if userManager.userId != nil {
            if segments.isEmpty {
                filteredSurveys = []
                return
            }

            filteredSurveys = filterSurveysBasedOnSegments(filteredSurveys, segments: segments)
        }
    }

    /// Checks if there are any surveys to display, based in the track action, and if so, displays the first one.
    /// Handles the display percentage and the delay of the survey.
    func track(_ action: String, hiddenFields: [String: Any]? = nil) {
        guard !isShowingSurvey else { return }

        let actionClasses = environmentResponse?.data.data.actionClasses ?? []
        let codeActionClasses = actionClasses.filter { $0.type == "code" }
        let actionClass = codeActionClasses.first { $0.key == action }
        let firstSurveyWithActionClass = filteredSurveys.first { survey in
            return survey.triggers?.contains(where: { $0.actionClass?.name == actionClass?.name }) ?? false
        }

        if (firstSurveyWithActionClass == nil) {
            Formbricks.delegate?.onError(FormbricksSDKError(type: .surveyNotFoundError))
        }

        // Display percentage
        let shouldDisplay = shouldDisplayBasedOnPercentage(firstSurveyWithActionClass?.displayPercentage)
        let isMultiLangSurvey = firstSurveyWithActionClass?.languages?.count ?? 0 > 1

        if isMultiLangSurvey {
            guard let survey = firstSurveyWithActionClass else {return}
            let currentLanguage = Formbricks.language
            guard let languageCode = getLanguageCode(survey: survey, language: currentLanguage) else {
                Formbricks.logger?.error("Survey \(survey.name) is not available in language “\(currentLanguage)”. Skipping.")
                return
            }

            Formbricks.language = languageCode
        }

        // Display and delay it if needed
        if let surveyId = firstSurveyWithActionClass?.id, shouldDisplay {
            isShowingSurvey = true
            let timeout = firstSurveyWithActionClass?.delay ?? 0
            DispatchQueue.global().asyncAfter(deadline: .now() + Double(timeout)) { [weak self] in
                self?.showSurvey(withId: surveyId, hiddenFields: hiddenFields)
                Formbricks.delegate?.onSuccess(.onFoundSurvey)
            }
        }
    }
}

// MARK: - API calls -
extension SurveyManager {
    /// Checks if the environment state needs to be refreshed based on its `expiresAt` property, and if so, refreshes it, starts the refresh timer, and filters the surveys.
    func refreshEnvironmentIfNeeded(force: Bool = false,
                                    isInitial: Bool = false) {
        if (!force) {
            if let environmentResponse = environmentResponse, environmentResponse.data.expiresAt.timeIntervalSinceNow > 0 {
                Formbricks.logger?.debug("Environment state is still valid until \(environmentResponse.data.expiresAt)")
                filterSurveys()
                return
            }
        }

        service.getEnvironmentState { [weak self] result in
            switch result {
            case .success(let response):
                self?.hasApiError = false
                self?.environmentResponse = response
                self?.startRefreshTimer(expiresAt: response.data.expiresAt)
                self?.filterSurveys()
                if (isInitial) {
                    Formbricks.delegate?.onSuccess(.onFinishedSetup)
                } else {
                    Formbricks.delegate?.onSuccess(.onFinishedRefreshEnvironment)
                }
            case .failure:
                self?.hasApiError = true
                let error = FormbricksSDKError(type: .unableToRefreshEnvironment)
                Formbricks.delegate?.onError(error)
                Formbricks.logger?.error(error.message)
                self?.startErrorTimer()
            }
        }
    }

    /// Posts a survey response to the Formbricks API.
    func postResponse(surveyId: String) {
        userManager.onResponse(surveyId: surveyId)
    }

    /// Creates a new display for the survey. It is called when the survey is displayed to the user.
    func onNewDisplay(surveyId: String) {
        userManager.onDisplay(surveyId: surveyId)
        Formbricks.delegate?.onSurveyDisplayed()
    }
}

// MARK: - Present and dismiss survey window -
extension SurveyManager {
    /// Dismisses the presented survey window.
    func dismissSurveyWebView() {
        isShowingSurvey = false
        presentSurveyManager.dismissView()
    }
}

private extension SurveyManager {
    /// Presents the survey window with the given id. It is called when a survey is triggered.
    /// The survey is displayed based on the `FormbricksView`.
    /// The view controller is presented over the current context.
    func showSurvey(withId id: String, hiddenFields: [String: Any]? = nil) {
        if let environmentResponse = environmentResponse {
            presentSurveyManager.present(environmentResponse: environmentResponse, id: id, hiddenFields: hiddenFields)
        }

    }

    /// Starts a timer to refresh the environment state after the given timeout (`expiresAt`).
    func startRefreshTimer(expiresAt: Date) {
        let timeout = expiresAt.timeIntervalSinceNow
        refreshEnvironmentAfter(timeout: timeout)
    }

    /// When an error occurs, it starts a timer to refresh the environment state after the given timeout.
    func startErrorTimer() {
        refreshEnvironmentAfter(timeout: Double(Config.Environment.refreshStateOnErrorTimeoutInMinutes) * 60.0)
    }

    /// Refreshes the environment state after the given timeout.
    func refreshEnvironmentAfter(timeout: Double) {
        guard timeout > 0 else {
            return
        }

        DispatchQueue.global().asyncAfter(deadline: .now() + timeout) { [weak self] in
            Formbricks.logger?.debug("Refreshing environment state.")
            self?.refreshEnvironmentIfNeeded(force: true)
        }
    }

    /// Decides if the survey should be displayed based on the display percentage.
    func shouldDisplayBasedOnPercentage(_ displayPercentage: Double?) -> Bool {
        guard let displayPercentage = displayPercentage else { return true }
        let randomNum = Double(Int.random(in: 0..<10000)) / 100.0
        return randomNum <= displayPercentage
    }
}

// MARK: - Store data in the UserDefaults -
extension SurveyManager {
    var environmentResponse: EnvironmentResponse? {
        get {
            if let environmentResponse = backingEnvironmentResponse {
                return environmentResponse
            } else {
                if let data = UserDefaults.standard.data(forKey: SurveyManager.environmentResponseObjectKey) {
                    return try? JSONDecoder().decode(EnvironmentResponse.self, from: data)
                } else {
                    let error = FormbricksSDKError(type: .unableToRetrieveEnvironment)
                    Formbricks.delegate?.onError(error)
                    Formbricks.logger?.error(error.message)
                    return nil
                }
            }
        } set {
            if let data = try? JSONEncoder().encode(newValue) {
                UserDefaults.standard.set(data, forKey: SurveyManager.environmentResponseObjectKey)
                backingEnvironmentResponse = newValue
            } else {
                let error = FormbricksSDKError(type: .unableToPersistEnvironment)
                Formbricks.delegate?.onError(error)
                Formbricks.logger?.error(error.message)
            }
        }
    }
}

// MARK: - Helper methods -
private extension SurveyManager {
    /// Filters the surveys based on the display type and limit.
    func filterSurveysBasedOnDisplayType(_ surveys: [Survey], displays: [Display], responses: [String]) -> [Survey] {
        return surveys.filter { survey in
            switch survey.displayOption {
            case .respondMultiple:
                return true

            case .displayOnce:
                return !displays.contains { $0.surveyId == survey.id }

            case .displayMultiple:
                return !responses.contains { $0 == survey.id }

            case .displaySome:
                if let limit = survey.displayLimit {
                    if responses.contains(where: { $0 == survey.id }) {
                        return false
                    }
                    return displays.filter { $0.surveyId == survey.id }.count < limit
                } else {
                    return true
                }

            default:
                let error = FormbricksSDKError(type: .invalidDisplayOption)
                Formbricks.delegate?.onError(error)
                Formbricks.logger?.error(error.message)
                return false
            }


        }
    }

    /// Filters the surveys based on the recontact days and the `lastDisplayedAt` date.
    func filterSurveysBasedOnRecontactDays(_ surveys: [Survey], defaultRecontactDays:  Int?) -> [Survey] {
        surveys.filter { survey in
            guard let lastDisplayedAt = userManager.lastDisplayedAt else { return true }
            let recontactDays = survey.recontactDays ?? defaultRecontactDays

            if let recontactDays = recontactDays {
                return Calendar.current.numberOfDaysBetween(Date(), and: lastDisplayedAt) >= recontactDays
            }

            return true
        }
    }

    func getLanguageCode(
        survey: Survey,
        language: String?
    ) -> String? {
        // 1) Collect all codes
        let availableLanguageCodes = survey.languages?
            .map { $0.language.code }

        // 2) If no language was passed or it's the explicit "default" token → default
        guard let raw = language?.lowercased(), !raw.isEmpty else {
            return "default"
        }

        if raw == "default" {
            return "default"
        }

        // 3) Find matching entry by code or alias
        let selected = survey.languages?.first { entry in
            entry.language.code.lowercased() == raw ||
            entry.language.alias?.lowercased() == raw
        }

        // 4) If that entry is marked default → default
        if selected?.isDefault == true {
            return "default"
        }

        // 5) If no entry, or not enabled, or code not in the available list → nil
        guard
            let entry = selected,
            entry.enabled,
            availableLanguageCodes?.contains(entry.language.code) == true
        else {
            return nil
        }

        // 6) Otherwise return its code
        return entry.language.code
    }
    
    /// Filters the surveys based on the user's segments.
    func filterSurveysBasedOnSegments(_ surveys: [Survey], segments: [String]) -> [Survey] {
        return surveys.filter { survey in
            guard let segmentId = survey.segment?.id else { return false }
            return segments.contains(segmentId)
        }
    }
    
}
