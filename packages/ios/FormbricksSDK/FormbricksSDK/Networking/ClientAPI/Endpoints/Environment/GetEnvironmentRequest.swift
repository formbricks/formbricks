struct GetEnvironmentRequest: CodableRequest {
    typealias Response = EnvironmentResponse
    var requestEndPoint: String { return FormbricksEnvironment.getEnvironmentRequestEndpoint }
    var requestType: HTTPMethod {  return .get }
}
