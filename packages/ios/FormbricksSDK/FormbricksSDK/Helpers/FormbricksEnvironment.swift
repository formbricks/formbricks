import Foundation

internal enum FormbricksEnvironment {

  /// Only `appUrl` is user-supplied. Crash early if it’s missing.
  fileprivate static var baseApiUrl: String {
    guard let url = Formbricks.appUrl else {
      fatalError("Formbricks.setup must be called before using the SDK.")
    }
    return url
  }

  /// Returns the full survey‐script URL as a String
  static var surveyScriptUrlString: String {
    let path = "/" + ["js", "surveys.umd.cjs"].joined(separator: "/")
    return baseApiUrl + path
  }

  /// Returns the full environment‐fetch URL as a String for the given ID
    static var getEnvironmentRequestEndpoint: String {
      let path = "/" + ["api", "v2", "client", "{environmentId}", "environment"]
      .joined(separator: "/")
    return path
  }

  /// Returns the full post-user URL as a String for the given ID
    static var postUserRequestEndpoint: String {
    let path = "/" + ["api", "v2", "client", "{environmentId}", "user"]
      .joined(separator: "/")
    return baseApiUrl + path
  }
}
