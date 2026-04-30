// swift-tools-version: 5.9
/******************************** Package.swift ***************************************
 *
 *  Module: Swift Package Configuration
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
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.3.1"),
        .package(name: "CapacitorCamera", path: "../../../node_modules/@capacitor/camera")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCamera", package: "CapacitorCamera")
            ]
        )
    ]
)
