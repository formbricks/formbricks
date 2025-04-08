import Foundation

class APIClient<Request: CodableRequest>: Operation, @unchecked Sendable {
    
    //private let session = URLSession.shared
    
    private let session = URLSession(configuration: URLSessionConfiguration.ephemeral,
                                     delegate: SSLPinningDelegate(),
                                     delegateQueue: nil)
    private let request: Request
    private let completion: ((ResultType<Request.Response>) -> Void)?
    private let maxRetryCount = 3
    
    init(request: Request, completion: ((ResultType<Request.Response>) -> Void)?) {
        self.request = request
        self.completion = completion
    }
    
    override func main() {
        performRequest(retryCount: 0)
    }
    
    private func performRequest(retryCount: Int) {
        guard let apiURL = request.baseURL, var baseUrlComponents = URLComponents(string: apiURL) else {
            completion?(.failure(FormbricksSDKError(type: .sdkIsNotInitialized)))
            return
        }
        
        baseUrlComponents.queryItems = request.queryParams?.map { URLQueryItem(name: $0.key, value: $0.value) }
        
        guard var finalURL = baseUrlComponents.url else {
            completion?(.failure(FormbricksSDKError(type: .invalidAppUrl)))
            return
        }
        
        guard let requestEndPoint = setPathParams(request.requestEndPoint) else {
            completion?(.failure(FormbricksSDKError(type: .sdkIsNotInitialized)))
            return
        }
        
        finalURL.appendPathComponent(requestEndPoint)
        
        let urlRequest = createURLRequest(forURL: finalURL)
        
        // LOG
        var requestLogMessage = "\(request.requestType.rawValue) >>> "
        if let urlString = urlRequest.url?.absoluteString {
            requestLogMessage.append(urlString)
        }
        if let headers = urlRequest.allHTTPHeaderFields {
            requestLogMessage.append("\nHeaders: \(headers)")
        }
        if let body = urlRequest.httpBody {
            requestLogMessage.append("\nBody: \(String(data: body, encoding: .utf8) ?? "")")
        }
        
        Formbricks.logger.info(requestLogMessage)
        
        session.dataTask(with: urlRequest) { (data, response, error) in
            if let httpStatus = (response as? HTTPURLResponse)?.status {
                var responseLogMessage = "\(httpStatus.rawValue) <<< "
                if let urlString = response?.url?.absoluteString {
                    responseLogMessage.append(urlString)
                }
                
                if httpStatus.responseType == .success {
                    guard let data = data else {
                        let error = FormbricksAPIClientError(type: .invalidResponse, statusCode: httpStatus.rawValue)
                        Formbricks.delegate?.onError(error)
                        self.completion?(.failure(error))
                        return
                    }
                    if let responseString = String(data: data, encoding: .utf8) {
                        responseLogMessage.append("\n\(responseString)\n")
                    }
                    
                    do {
                        if Request.Response.self == VoidResponse.self {
                            Formbricks.logger.info(responseLogMessage)
                            self.completion?(.success(VoidResponse() as! Request.Response))
                        } else {
                            var body = try self.request.decoder.decode(Request.Response.self, from: data)
                            Formbricks.logger.info(responseLogMessage)
                            
                            // We want to save the entire response dictionary for the environment response
                            if var environmentResponse = body as? EnvironmentResponse,
                               let jsonString = String(data: data, encoding: .utf8) {
                                environmentResponse.responseString = jsonString
                                body = environmentResponse as! Request.Response
                            }

                            
                            self.completion?(.success(body))
                        }
                    }
                    catch let DecodingError.dataCorrupted(context) {
                        responseLogMessage.append("Data corrupted \(context)\n")
                        Formbricks.logger.error(responseLogMessage)
                        let error = FormbricksAPIClientError(type: .invalidResponse, statusCode: httpStatus.rawValue)
                        Formbricks.delegate?.onError(error)
                        self.completion?(.failure(error))
                    }
                    catch let DecodingError.keyNotFound(key, context) {
                        responseLogMessage.append("Key '\(key)' not found: \(context.debugDescription)\n")
                        responseLogMessage.append("codingPath: \(context.codingPath)")
                        Formbricks.logger.error(responseLogMessage)
                        let error = FormbricksAPIClientError(type: .invalidResponse, statusCode: httpStatus.rawValue)
                        Formbricks.delegate?.onError(error)
                        self.completion?(.failure(error))
                    }
                    catch let DecodingError.valueNotFound(value, context) {
                        responseLogMessage.append("Value '\(value)' not found: \(context.debugDescription)\n")
                        responseLogMessage.append("codingPath: \(context.codingPath)")
                        Formbricks.logger.error(responseLogMessage)
                        let error = FormbricksAPIClientError(type: .invalidResponse, statusCode: httpStatus.rawValue)
                        Formbricks.delegate?.onError(error)
                        self.completion?(.failure(error))
                    }
                    catch let DecodingError.typeMismatch(type, context)  {
                        responseLogMessage.append("Type '\(type)' mismatch: \(context.debugDescription)\n")
                        responseLogMessage.append("codingPath: \(context.codingPath)")
                        Formbricks.logger.error(responseLogMessage)
                        let error = FormbricksAPIClientError(type: .invalidResponse, statusCode: httpStatus.rawValue)
                        Formbricks.delegate?.onError(error)
                        self.completion?(.failure(error))
                    }
                    catch {
                        responseLogMessage.append("error: \(error.message)")
                        Formbricks.logger.error(responseLogMessage)
                        let error = FormbricksAPIClientError(type: .invalidResponse, statusCode: httpStatus.rawValue)
                        Formbricks.delegate?.onError(error)
                        self.completion?(.failure(error))
                    }
                } else {
                    if let error = error {
                        responseLogMessage.append("\nError: \(error.localizedDescription)")
                        Formbricks.logger.error(responseLogMessage)
                        
                        if retryCount < self.maxRetryCount {
                            DispatchQueue.global().asyncAfter(deadline: .now() + 3) {
                                self.performRequest(retryCount: retryCount + 1)
                            }
                        } else {
                            self.completion?(.failure(error))
                        }
                    } else if let data = data, let apiError = try? self.request.decoder.decode(FormbricksAPIError.self, from: data) {
                        Formbricks.logger.error("\(responseLogMessage)\n\(apiError.getDetailedErrorMessage())")
                        self.completion?(.failure(apiError))
                    } else {
                        let error = FormbricksAPIClientError(type: .responseError, statusCode: httpStatus.rawValue)
                        Formbricks.logger.error("\(responseLogMessage)\n\(error.message)")
                        self.completion?(.failure(error))
                    }
                }
            } else {
                let error = FormbricksAPIClientError(type: .invalidResponse)
                Formbricks.logger.error("ERROR \(error.message)")
                
                if retryCount < self.maxRetryCount {
                    DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
                        self.performRequest(retryCount: retryCount + 1)
                    }
                } else {
                    Formbricks.delegate?.onError(error)
                    self.completion?(.failure(error))
                }
            }
        }.resume()
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

class SSLPinningDelegate: NSObject, URLSessionDelegate {
    func urlSession(_ session: URLSession,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        
        guard let securityCertData = Formbricks.securityCertData else {
            // No pinning cert available, fallback to default handling
            if let serverTrust = challenge.protectionSpace.serverTrust {
                let credential = URLCredential(trust: serverTrust)
                completionHandler(.useCredential, credential)
            } else {
                completionHandler(.cancelAuthenticationChallenge, nil)
            }
            return
        }
        
        guard let serverTrust = challenge.protectionSpace.serverTrust,
              let certificate = SecTrustGetCertificateAtIndex(serverTrust, 0) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        let serverCertificateData = SecCertificateCopyData(certificate) as Data
        
        if serverCertificateData == securityCertData {
            let credential = URLCredential(trust: serverTrust)
            completionHandler(.useCredential, credential)
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}

