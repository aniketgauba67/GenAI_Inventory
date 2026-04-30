/******************************** ViewController.swift ***************************************
 *
 *  Module: iOS View Controller
 *
 *  This file supports the iOS shell for the Capacitor mobile app.
 *
 *  The file provides:
 *
 *  - iOS app delegate, view controller, package, or property settings.
 *  - native project metadata required by Capacitor.
 *  - mobile packaging support for the inventory frontend.
 *
 *  Key Structures Used:
 *
 *  - Swift application classes, plist entries, and Xcode build settings.
 *
 *  This file ensures:
 *
 *  - the web application can be packaged as an iOS app.
 *  - native mobile settings stay discoverable for the team.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
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
