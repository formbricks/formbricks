import Foundation

typealias ResultType<T> = Result<T, Error>
struct VoidResponse: Codable {}

// MARK: - Method types -
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

// MARK: - Encoding type -
enum EncodingType {
    case url
    case json
}

// MARK: - Base API protocol -
protocol BaseApiRequest {
    var requestEndPoint: String { get }
    var requestType: HTTPMethod { get }
    var encoding: EncodingType { get }
    var headers: [String:String]? { get }
    var requestBody: Data? { get }
}

extension BaseApiRequest {
    
    var encoding: EncodingType {
        return .json
    }
    
    var requestBody: Data? {
        return nil
    }
    
    var headers: [String:String]? {
        return [:]
    }
}

// MARK: - Codable protocol -
protocol CodableRequest: BaseApiRequest {
    associatedtype Response: Decodable
    associatedtype ErrorType: Error & Decodable
    
    var baseURL: String? { get }
    
    var decoder: JSONDecoder { get }
    
    var queryParams: [String: String]? { get }
    
    var pathParams: [String: String]? { get }
}

extension CodableRequest {
    typealias ErrorType = RuntimeError
    
    var baseURL: String? {
        return Formbricks.appUrl
    }
    
    var decoder: JSONDecoder {
        return JSONDecoder.iso8601Full
    }
    
    var queryParams: [String: String]? {
        return nil
    }
    
    
    var pathParams: [String: String]? {
        return nil
    }
}

// MARK: - Encodable protocol -
class EncodableRequest<EncodableObject: Encodable> {
    let object: EncodableObject
    let encoder: JSONEncoder
    
    init(object: EncodableObject, encoder: JSONEncoder = JSONEncoder.iso8601Full) {
        self.object = object
        self.encoder = encoder
    }
    
    var requestBody: Data? {
        guard let data = try? self.encoder.encode(self.object) else {
            assertionFailure("Unable to encode object: \(self.object)")
            return nil
        }
        return data
    }
}
