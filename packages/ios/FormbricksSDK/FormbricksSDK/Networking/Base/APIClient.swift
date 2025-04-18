import Foundation

class APIClient<Request: CodableRequest>: Operation, @unchecked Sendable {
    
    private let session = URLSession.shared
    private let request: Request
    private let completion: ((ResultType<Request.Response>) -> Void)?
    
    init(request: Request, completion: ((ResultType<Request.Response>) -> Void)?) {
        self.request = request
        self.completion = completion
    }
    
    override func main() {
        guard let finalURL = buildFinalURL() else {
            completion?(.failure(FormbricksSDKError(type: .sdkIsNotInitialized)))
            return
        }
        
        let urlRequest = createURLRequest(forURL: finalURL)
        logRequest(urlRequest)
        
        session.dataTask(with: urlRequest) { [weak self] data, response, error in
            self?.processResponse(data: data, response: response, error: error)
        }.resume()
    }
    
    private func buildFinalURL() -> URL? {
        guard let apiURL = request.baseURL, var components = URLComponents(string: apiURL) else { return nil }
        
        components.queryItems = request.queryParams?.map { URLQueryItem(name: $0.key, value: $0.value) }
        
        guard var url = components.url, let path = setPathParams(request.requestEndPoint) else { return nil }

        url.appendPathComponent(path)
        return url
    }
    
    private func processResponse(data: Data?, response: URLResponse?, error: Error?) {
        guard let httpStatus = (response as? HTTPURLResponse)?.status else {
            let error = FormbricksAPIClientError(type: .invalidResponse)
            Formbricks.logger?.error("ERROR \(error.message)")
            completion?(.failure(error))
            return
        }

        var message = "\(httpStatus.rawValue) <<< \(response?.url?.absoluteString ?? "")"
        
        if httpStatus.responseType == .success {
            handleSuccessResponse(data: data, statusCode: httpStatus.rawValue, message: &message)
        } else {
            handleFailureResponse(data: data, error: error, statusCode: httpStatus.rawValue, message: message)
        }
    }
    
    private func handleSuccessResponse(data: Data?, statusCode: Int, message: inout String) {
        guard let data = data else {
            completion?(.failure(FormbricksAPIClientError(type: .invalidResponse, statusCode: statusCode)))
            return
        }

        if let responseString = String(data: data, encoding: .utf8) {
            message.append("\n\(responseString)\n")
        }

        do {
            if Request.Response.self == VoidResponse.self {
                Formbricks.logger?.info(message)
                completion?(.success(VoidResponse() as! Request.Response))
            } else {
                var body = try request.decoder.decode(Request.Response.self, from: data)
                if var env = body as? EnvironmentResponse, let jsonString = String(data: data, encoding: .utf8) {
                    env.responseString = jsonString
                    body = env as! Request.Response
                }
                Formbricks.logger?.info(message)
                completion?(.success(body))
            }
        } catch {
            handleDecodingError(error, message: &message, statusCode: statusCode)
        }
    }
    
    private func handleFailureResponse(data: Data?, error: Error?, statusCode: Int, message: String) {
        var log = message

        if let error = error {
            log.append("\nError: \(error.localizedDescription)")
            Formbricks.logger?.error(log)
            completion?(.failure(error))
        } else if let data = data, let apiError = try? request.decoder.decode(FormbricksAPIError.self, from: data) {
            Formbricks.logger?.error("\(log)\n\(apiError.getDetailedErrorMessage())")
            completion?(.failure(apiError))
        } else {
            let error = FormbricksAPIClientError(type: .responseError, statusCode: statusCode)
            Formbricks.logger?.error("\(log)\n\(error.message)")
            completion?(.failure(error))
        }
    }
    
    private func handleDecodingError(_ error: Error, message: inout String, statusCode: Int) {
        switch error {
        case let DecodingError.dataCorrupted(context):
            message.append("Data corrupted: \(context)")
        case let DecodingError.keyNotFound(key, context):
            message.append("Key '\(key)' not found: \(context.debugDescription)\ncodingPath: \(context.codingPath)")
        case let DecodingError.valueNotFound(value, context):
            message.append("Value '\(value)' not found: \(context.debugDescription)\ncodingPath: \(context.codingPath)")
        case let DecodingError.typeMismatch(type, context):
            message.append("Type '\(type)' mismatch: \(context.debugDescription)\ncodingPath: \(context.codingPath)")
        default:
            message.append("Error: \(error.localizedDescription)")
        }

        Formbricks.logger?.error(message)
        completion?(.failure(FormbricksAPIClientError(type: .invalidResponse, statusCode: statusCode)))
    }
    
    private func logRequest(_ request: URLRequest) {
        var message = "\(request.httpMethod ?? "") >>> \(request.url?.absoluteString ?? "")"
        
        if let headers = request.allHTTPHeaderFields {
            message.append("\nHeaders: \(headers)")
        }
        
        if let body = request.httpBody, let bodyString = String(data: body, encoding: .utf8) {
            message.append("\nBody: \(bodyString)")
        }

        Formbricks.logger?.info(message)
    }

}

private extension APIClient {
    func createURLRequest(forURL url: URL) -> URLRequest {
        var urlRequest = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 10)
    
        request.headers?.forEach {
            urlRequest.addValue($0.value, forHTTPHeaderField: $0.key)
        }
        
        urlRequest.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        urlRequest.httpMethod = request.requestType.rawValue
        
        if let body = request.requestBody {
            urlRequest.httpBody = body
        }
        
        return urlRequest
    }
    
    func setPathParams(_ path: String) -> String? {
        var newPath = path
        if let environmentId = Formbricks.environmentId {
            newPath = newPath.replacingOccurrences(of: "{environmentId}", with: environmentId)
        }
        
        request.pathParams?.forEach { key, value in
            newPath = newPath.replacingOccurrences(of: key, with: value)
        }
        
        return newPath
    }
}
