struct EnvironmentData: Codable {
    let surveys: [Survey]?
    let actionClasses: [ActionClass]?
    let project: Project
    let recaptchaSiteKey: String?
}
