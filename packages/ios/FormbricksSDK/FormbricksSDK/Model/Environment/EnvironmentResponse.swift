struct EnvironmentResponse: Codable {
    let data: EnvironmentResponseData
    
    var responseString: String?
    
    enum CodingKeys: CodingKey {
        case data
        case responseString
    }
}

extension EnvironmentResponse {
    func getSurveyJson(forSurveyId surveyId: String) -> [String: Any]? {
        guard let jsonData = responseString?.data(using: .utf8) else { return nil }
        let responseDictionary = try? JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]
        let responseDict = responseDictionary?["data"] as? [String: Any]
        let dataDict = responseDict?["data"] as? [String: Any]
        let surveysArray = dataDict?["surveys"] as? [[String: Any]]
        return surveysArray?.first(where: { $0["id"] as? String == surveyId }) as? [String: Any]
    }
    
    func getSurveyStylingJson(forSurveyId surveyId: String) -> [String: Any]? {
        guard let jsonData = responseString?.data(using: .utf8) else { return nil }
        let responseDictionary = try? JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]
        let responseDict = responseDictionary?["data"] as? [String: Any]
        let dataDict = responseDict?["data"] as? [String: Any]
        let surveysArray = dataDict?["surveys"] as? [[String: Any]]
        let survey = surveysArray?.first(where: { $0["id"] as? String == surveyId }) as? [String: Any]
        return survey?["styling"] as? [String: Any]
    }

    func getProjectStylingJson() -> [String: Any]? {
        guard let jsonData = responseString?.data(using: .utf8) else { return nil }
        let responseDictionary = try? JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]
        let responseDict = responseDictionary?["data"] as? [String: Any]
        let dataDict = responseDict?["data"] as? [String: Any]
        let projectDict = dataDict?["project"] as? [String: Any]
        return projectDict?["styling"] as? [String: Any]
    }
}
