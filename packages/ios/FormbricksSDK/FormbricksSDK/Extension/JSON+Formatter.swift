import Foundation

extension DateFormatter {
    static var isoFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZZZZZ"
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }
}

extension JSONDecoder {
    static let iso8601Full: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .formatted(DateFormatter.isoFormatter)
        return decoder
        
    }()
}
    
extension JSONEncoder {
    static let iso8601Full: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .formatted(DateFormatter.isoFormatter)
        return encoder
    }()
}
