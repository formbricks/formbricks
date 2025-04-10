import Foundation

class FormbricksEnvironment {
    public static let baseApiUrl: String = Formbricks.appUrl ?? "http://localhost:3000"
    public static let surveyScriptUrl: String = "\(baseApiUrl)/js/surveys.umd.cjs"
    /// Endpoint for getting environment data. Replace {environmentId} with the actual environment ID.
    public static let getEnvironmentRequestEndpoint: String = "/api/v2/client/{environmentId}/environment"
    /// Endpoint for posting user data. Replace {environmentId} with the actual environment ID.
    public static let postUserRequestEndpoint: String = "/api/v2/client/{environmentId}/user"
}
