import Foundation

class FormbricksEnvironment {
    static var baseApiUrl: String = Formbricks.appUrl ?? "http://localhost:3000"
    static var surveyScriptUrl: String = "\(baseApiUrl)/js/surveys.umd.cjs"
    static var getEnvironmentRequestEndpoint: String = "/api/v2/client/{environmentId}/environment"
    static var postUserRequestEndpoint: String = "/api/v2/client/{environmentId}/user"
}
