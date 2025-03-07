import SwiftUI
import FormbricksSDK

struct ContentView: View {
    var body: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                Button("Click me!") {
                    Formbricks.track("click_demo_button")
                }
                Spacer()
            }
            .padding()
            Spacer()
        }
    }
    
}

#Preview {
    ContentView()
}
