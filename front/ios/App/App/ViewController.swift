import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        // Push all web content below the status bar natively — no server
        // changes required. The scroll view insets the content area by the
        // safe area height so nothing overlaps the clock/battery indicators.
        webView?.scrollView.contentInsetAdjustmentBehavior = .always
    }
}
