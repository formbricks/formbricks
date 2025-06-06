final class PostUserRequest: EncodableRequest<PostUserRequest.Body>, CodableRequest {
    var requestEndPoint: String { return FormbricksEnvironment.postUserRequestEndpoint }
    var requestType: HTTPMethod { return .post }
    
    
    struct Response: Codable {
        let data: UserResponseData
    }
    
    struct Body: Codable {
        let userId: String
        let attributes: [String: String]?
    }
    
        
    init(userId: String, attributes: [String: String]?) {
        super.init(object: Body(userId: userId, attributes: attributes))
    }
}
