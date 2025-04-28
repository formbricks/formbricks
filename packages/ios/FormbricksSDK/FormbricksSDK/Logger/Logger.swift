import Foundation

@objc public enum LogLevel: Int {
    case verbose
    case debug
    case info
    case warning
    case error
    case none
}

class Logger {
    var logLevel: LogLevel = .none
    let name: String
    let emoji: String = "📝"
    
    init(name: String = "FormbricksSDK") {
        self.name = name
    }
    
    func verbose(_ message: Any = "", filename: String = #file, function: String =  #function, line: Int = #line) {
        log(message, logLevel: .verbose, filename: filename, function: function, line: line)
    }
    
    func debug(_ message: Any = "", filename: String = #file, function: String =  #function, line: Int = #line) {
        log(message, logLevel: .debug, filename: filename, function: function, line: line)
    }
    
    func info(_ message: Any = "", filename: String = #file, function: String =  #function, line: Int = #line) {
        log(message, logLevel: .info, filename: filename, function: function, line: line)
    }
    
    func warning(_ message: Any = "", filename: String = #file, function: String =  #function, line: Int = #line) {
        log(message, logLevel: .warning, filename: filename, function: function, line: line)
    }
    
    func error(_ message: Any = "", filename: String = #file, function: String =  #function, line: Int = #line) {
        log(message, logLevel: .error, filename: filename, function: function, line: line)
    }
}

private extension Logger {
    
    func log(_ message: Any = "", logLevel: LogLevel = .debug, filename: String, function: String, line: Int) {
        guard ( logLevel == .error || logLevel.rawValue >= self.logLevel.rawValue ) else { return }
        let body = regularBody(filename: filename, function: function, line: line)
        var logString = regularLog(messageHeader: regularHeader(), messageBody: body, logLevel: logLevel)
        
        let messageString = String(describing: message)
        if !messageString.isEmpty {
            let messageListString = messageString.split(separator: "\n").map { "\(emoji)└ 📣 \($0)\n" }.joined()
            logString.append(messageListString)
        }
        if logLevel == .error || logLevel.rawValue >= self.logLevel.rawValue {
            DispatchQueue.main.async { [weak self] in
                let str = logString + "\(self?.emoji ?? "")\n"
                print(str)
            }
        }
    }
    
    func regularHeader() -> String {
        return " \(formattedDate()) "
    }
    
    func regularBody(filename: String, function: String, line: Int) -> String {
        return " \(filenameWithoutPath(filename: filename)), in \(function) at #\(line) "
    }
    
    func regularLog(messageHeader: String, messageBody: String, logLevel: LogLevel) -> String {
        let nameString = " \(name) "
        let logLevelString = getString(forLogLevel: logLevel)
        let logLevelHorizontalLine = horizontalLine(for: logLevelString)
        let headerHorizontalLine = horizontalLine(for: messageHeader)
        let bodyHorizontalLine = horizontalLine(for: messageBody)
        let nameHorizontalLine = horizontalLine(for: nameString)
        
        var logString = ""
        logString.append("\(emoji)┌\(nameHorizontalLine)┬\(logLevelHorizontalLine)┬\(headerHorizontalLine)┬\(bodyHorizontalLine)┐\n")
        logString.append("\(emoji)│\(nameString)│\(logLevelString)│\(messageHeader)│\(messageBody)│\n")
        logString.append("\(emoji)└\(nameHorizontalLine)┴\(logLevelHorizontalLine)┴\(headerHorizontalLine)┴\(bodyHorizontalLine)┘\n")
        return logString
    }
    
    /// Returns a `String` composed by horizontal box-drawing characters (─) based on the given message length.
    ///
    /// For example:
    ///
    ///     " ViewController.swift, in viewDidLoad() at 26 " // Message
    ///     "──────────────────────────────────────────────" // Returned String
    ///
    /// Reference: [U+250x Unicode](https://en.wikipedia.org/wiki/Box-drawing_character)
    func horizontalLine(for message: String) -> String {
        return Array(repeating: "─", count: message.count).joined()
    }
    
    func getString(forLogLevel logLevel: LogLevel) -> String {
        switch logLevel {
        case .verbose:
            return " VERBOSE "
        case .debug:
            return " DEBUG "
        case .info:
            return " INFO "
        case .warning:
            return " WARNING "
        case .error:
            return " ERROR "
        default:
            return ""
        }
    }
}

// MARK: Util

private extension Logger {
    /// "/Users/blablabla/Class.swift" becomes "Class.swift"
    func filenameWithoutPath(filename: String) -> String {
        return URL(fileURLWithPath: filename).lastPathComponent
    }
    
    /// E.g. `15:25:04.749`
    func formattedDate() -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MM/dd/yy, HH:mm:ss.SSS"
        return "\(dateFormatter.string(from: Date()))"
    }
}
