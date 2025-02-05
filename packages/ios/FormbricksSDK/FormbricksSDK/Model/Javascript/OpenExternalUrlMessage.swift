struct OpenExternalUrlMessage: Codable {
    let event: EventType
    let onOpenExternalURLParams: OnOpenExternalURLParams
}

struct OnOpenExternalURLParams: Codable {
    let url: String
}
