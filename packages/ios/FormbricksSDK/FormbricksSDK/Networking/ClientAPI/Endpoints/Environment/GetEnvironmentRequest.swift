struct GetEnvironmentRequest: CodableRequest {
    typealias Response = EnvironmentResponse
    var requestEndPoint: String { return "/api/v1/client/{environmentId}/environment" }
    var requestType: HTTPMethod {  return .get }
}
