import SwiftUI
import FormbricksSDK

struct SetupView: View {
    @State private var isSetup = false
    @State private var isLoading = false
    
    var body: some View {
        VStack(spacing: 20) {
            if !isSetup {
                if isLoading {
                    ProgressView("Setting up...")
                        .padding()
                } else {
                    Button("Setup Formbricks SDK") {
                        isLoading = true
                        let config = FormbricksConfig.Builder(appUrl: "http://192.168.0.200:3000", environmentId: "cm9qk3m57000n195soukrmqhh")
                            .setLogLevel(.debug)
                            .build()
                        
                        // Simulate async setup delay
                        DispatchQueue.global().async {
                            Formbricks.setup(with: config, force: true)
                            
                            DispatchQueue.main.async {
                                isSetup = true
                                isLoading = false
                            }
                        }
                    }
                    .padding()
                }
            } else {
                Button("Call Formbricks.setUserId with a random userId") {
                    Formbricks.setUserId(UUID().uuidString)
                }.padding()
                
                Button("Call Formbricks.track") {
                    Formbricks.track("click_demo_button")
                }
                .padding()
                
                Button("Call Formbricks.setAttribute") {
                    Formbricks.setAttribute("test@example.com", forKey: "user_email")
                }
                .padding()
                
                Button("Call Formbricks.setAttributes") {
                    Formbricks.setAttributes(["user_name": "John Doe", "user_age": "30"])
                }
                .padding()
                
                Button("Call Formbricks.setLanguage") {
//                    Formbricks.setLanguage("en_us")
                    Formbricks.setLanguage("someything")
                }.padding()
                
                Button("Call Formbricks.logout") {
                    Formbricks.logout()
                }.padding()
                
                Button("Call Formbricks.cleanup") {
                    Formbricks.cleanup(waitForOperations: true) {
                        print(">>> Cleanup complete")
                        isSetup = false
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Setup SDK")
    }
}

#Preview {
    SetupView()
}
