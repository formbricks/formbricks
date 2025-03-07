import Foundation

enum HTTPStatusCode: Int, Error {
    
    enum ResponseType {
        /// - informational: This class of status code indicates a provisional response, consisting only of the Status-Line and optional headers, and is terminated by an empty line.
        case informational
        /// - success: This class of status codes indicates the action requested by the client was received, understood, accepted, and processed successfully.
        case success
        /// - redirection: This class of status code indicates the client must take additional action to complete the request.
        case redirection
        /// - clientError: This class of status code is intended for situations in which the client seems to have erred.
        case clientError
        /// - serverError: This class of status code indicates the server failed to fulfill an apparently valid request.
        case serverError
        /// - undefined: The class of the status code cannot be resolved.
        case undefined
    }
    
    // MARK: - Informational - 1xx -
    
    /// - continue: The server has received the request headers and the client should proceed to send the request body.
    case `continue` = 100
    
    /// - switchingProtocols: The requester has asked the server to switch protocols and the server has agreed to do so.
    case switchingProtocols = 101
    
    /// - processing: This code indicates that the server has received and is processing the request, but no response is available yet.
    case processing = 102
    
    // MARK: - Success - 2xx -
    
    /// - ok: Standard response for successful HTTP requests.
    case ok = 200
    
    /// - created: The request has been fulfilled, resulting in the creation of a new resource.
    case created = 201
    
    /// - accepted: The request has been accepted for processing, but the processing has not been completed.
    case accepted = 202
    
    /// - nonAuthoritativeInformation: The server is a transforming proxy (e.g. a Web accelerator) that received a 200 OK from its origin, but is returning a modified version of the origin's response.
    case nonAuthoritativeInformation = 203
    
    /// - noContent: The server successfully processed the request and is not returning any content.
    case noContent = 204
    
    /// - resetContent: The server successfully processed the request, but is not returning any content.
    case resetContent = 205
    
    /// - partialContent: The server is delivering only part of the resource (byte serving) due to a range header sent by the client.
    case partialContent = 206
    
    /// - multiStatus: The message body that follows is an XML message and can contain a number of separate response codes, depending on how many sub-requests were made.
    case multiStatus = 207
    
    /// - alreadyReported: The members of a DAV binding have already been enumerated in a previous reply to this request, and are not being included again.
    case alreadyReported = 208
    
    /// - IMUsed: The server has fulfilled a request for the resource, and the response is a representation of the result of one or more instance-manipulations applied to the current instance.
    case IMUsed = 226
    
    // MARK: - Redirection - 3xx -
    
    /// - multipleChoices: Indicates multiple options for the resource from which the client may choose
    case multipleChoices = 300
    
    /// - movedPermanently: This and all future requests should be directed to the given URI.
    case movedPermanently = 301
    
    /// - found: The resource was found.
    case found = 302
    
    /// - seeOther: The response to the request can be found under another URI using a GET method.
    case seeOther = 303
    
    /// - notModified: Indicates that the resource has not been modified since the version specified by the request headers If-Modified-Since or If-None-Match.
    case notModified = 304
    
    /// - useProxy: The requested resource is available only through a proxy, the address for which is provided in the response.
    case useProxy = 305
    
    /// - switchProxy: No longer used. Originally meant "Subsequent requests should use the specified proxy.
    case switchProxy = 306
    
    /// - temporaryRedirect: The request should be repeated with another URI.
    case temporaryRedirect = 307
    
    /// - permenantRedirect: The request and all future requests should be repeated using another URI.
    case permenantRedirect = 308
    
    // MARK: - Client Error - 4xx -
    
    /// - badRequest: The server cannot or will not process the request due to an apparent client error.
    case badRequest = 400
    
    /// - unauthorized: Similar to 403 Forbidden, but specifically for use when authentication is required and has failed or has not yet been provided.
    case unauthorized = 401
    
    /// - paymentRequired: The content available on the server requires payment.
    case paymentRequired = 402
    
    /// - forbidden: The request was a valid request, but the server is refusing to respond to it.
    case forbidden = 403
    
    /// - notFound: The requested resource could not be found but may be available in the future.
    case notFound = 404
    
    /// - methodNotAllowed: A request method is not supported for the requested resource. e.g. a GET request on a form which requires data to be presented via POST
    case methodNotAllowed = 405
    
    /// - notAcceptable: The requested resource is capable of generating only content not acceptable according to the Accept headers sent in the request.
    case notAcceptable = 406
    
    /// - proxyAuthenticationRequired: The client must first authenticate itself with the proxy.
    case proxyAuthenticationRequired = 407
    
    /// - requestTimeout: The server timed out waiting for the request.
    case requestTimeout = 408
    
    /// - conflict: Indicates that the request could not be processed because of conflict in the request, such as an edit conflict between multiple simultaneous updates.
    case conflict = 409
    
    /// - gone: Indicates that the resource requested is no longer available and will not be available again.
    case gone = 410
    
    /// - lengthRequired: The request did not specify the length of its content, which is required by the requested resource.
    case lengthRequired = 411
    
    /// - preconditionFailed: The server does not meet one of the preconditions that the requester put on the request.
    case preconditionFailed = 412
    
    /// - payloadTooLarge: The request is larger than the server is willing or able to process.
    case payloadTooLarge = 413
    
    /// - URITooLong: The URI provided was too long for the server to process.
    case URITooLong = 414
    
    /// - unsupportedMediaType: The request entity has a media type which the server or resource does not support.
    case unsupportedMediaType = 415
    
    /// - rangeNotSatisfiable: The client has asked for a portion of the file (byte serving), but the server cannot supply that portion.
    case rangeNotSatisfiable = 416
    
    /// - expectationFailed: The server cannot meet the requirements of the Expect request-header field.
    case expectationFailed = 417
    
    /// - teapot: This HTTP status is used as an Easter egg in some websites.
    case teapot = 418
    
    /// - misdirectedRequest: The request was directed at a server that is not able to produce a response.
    case misdirectedRequest = 421
    
    /// - unprocessableEntity: The request was well-formed but was unable to be followed due to semantic errors.
    case unprocessableEntity = 422
    
    /// - locked: The resource that is being accessed is locked.
    case locked = 423
    
    /// - failedDependency: The request failed due to failure of a previous request (e.g., a PROPPATCH).
    case failedDependency = 424
    
    /// - App update
    case appUpgradeRequired = 425
    
    /// - upgradeRequired: The client should switch to a different protocol such as TLS/1.0, given in the Upgrade header field.
    case upgradeRequired = 426
    
    /// - preconditionRequired: The origin server requires the request to be conditional.
    case preconditionRequired = 428
    
    /// - tooManyRequests: The user has sent too many requests in a given amount of time.
    case tooManyRequests = 429
    
    /// - requestHeaderFieldsTooLarge: The server is unwilling to process the request because either an individual header field, or all the header fields collectively, are too large.
    case requestHeaderFieldsTooLarge = 431
    
    /// - noResponse: Used to indicate that the server has returned no information to the client and closed the connection.
    case noResponse = 444
    
    /// - unavailableForLegalReasons: A server operator has received a legal demand to deny access to a resource or to a set of resources that includes the requested resource.
    case unavailableForLegalReasons = 451
    
    /// - SSLCertificateError: An expansion of the 400 Bad Request response code, used when the client has provided an invalid client certificate.
    case SSLCertificateError = 495
    
    /// - SSLCertificateRequired: An expansion of the 400 Bad Request response code, used when a client certificate is required but not provided.
    case SSLCertificateRequired = 496
    
    /// - HTTPRequestSentToHTTPSPort: An expansion of the 400 Bad Request response code, used when the client has made a HTTP request to a port listening for HTTPS requests.
    case HTTPRequestSentToHTTPSPort = 497
    
    /// - clientClosedRequest: Used when the client has closed the request before the server could send a response.
    case clientClosedRequest = 499
    
    // MARK: - Server Error - 5xx -
    
    /// - internalServerError: A generic error message, given when an unexpected condition was encountered and no more specific message is suitable.
    case internalServerError = 500
    
    /// - notImplemented: The server either does not recognize the request method, or it lacks the ability to fulfill the request.
    case notImplemented = 501
    
    /// - badGateway: The server was acting as a gateway or proxy and received an invalid response from the upstream server.
    case badGateway = 502
    
    /// - serviceUnavailable: The server is currently unavailable (because it is overloaded or down for maintenance). Generally, this is a temporary state.
    case serviceUnavailable = 503
    
    /// - gatewayTimeout: The server was acting as a gateway or proxy and did not receive a timely response from the upstream server.
    case gatewayTimeout = 504
    
    /// - HTTPVersionNotSupported: The server does not support the HTTP protocol version used in the request.
    case HTTPVersionNotSupported = 505
    
    /// - variantAlsoNegotiates: Transparent content negotiation for the request results in a circular reference.
    case variantAlsoNegotiates = 506
    
    /// - insufficientStorage: The server is unable to store the representation needed to complete the request.
    case insufficientStorage = 507
    
    /// - loopDetected: The server detected an infinite loop while processing the request.
    case loopDetected = 508
    
    /// - notExtended: Further extensions to the request are required for the server to fulfill it.
    case notExtended = 510
    
    /// - networkAuthenticationRequired: The client needs to authenticate to gain network access.
    case networkAuthenticationRequired = 511
    
    /// The class (or group) which the status code belongs to.
    var responseType: ResponseType {
        switch self.rawValue {
        case 100..<200:
            return .informational
        case 200..<300:
            return .success
        case 300..<400:
            return .redirection
        case 400..<500:
            return .clientError
        case 500..<600:
            return .serverError
        default:
            return .undefined
        }
    }
    
    var description: String? {
        switch self {
        case .unauthorized:
            return "Not authorized"
        case .notFound:
            return "Not found"
        case .unprocessableEntity:
            return "Error processing input"
        case .appUpgradeRequired:
            return "Please update to the latest version of the app"
        default:
            return nil
        }
    }
    
}

extension HTTPURLResponse {
    
    var status: HTTPStatusCode? {
        return HTTPStatusCode(rawValue: statusCode)
    }
    
}

