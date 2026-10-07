// Records one window of a process with ScreenCaptureKit (works while the window is covered by others) and writes
// every frame it delivers as a JPEG, optionally cropped. Used to film the Roblox Studio viewport for the devlogs.
// Usage: wincap <pid> <outdir> <max seconds> [cropX cropY cropW cropH]   (touch <outdir>/stop to end early)   (crop in window pixels; "list" as outdir lists windows)
import Foundation
import AppKit
import ScreenCaptureKit
import CoreImage
import ImageIO
import UniformTypeIdentifiers

_ = NSApplication.shared   // initialises the window server connection ScreenCaptureKit needs
let args = CommandLine.arguments
guard args.count >= 4, let pid = Int32(args[1]), let secs = Double(args[3]) else {
    print("usage: wincap <pid> <outdir> <seconds> [x y w h]"); exit(2)
}
let outDir = args[2]
let crop: CGRect? = args.count >= 8 ? CGRect(x: Double(args[4])!, y: Double(args[5])!, width: Double(args[6])!, height: Double(args[7])!) : nil
if outDir != "list" { try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true) }

final class Sink: NSObject, SCStreamOutput {
    var n = 0
    let ctx = CIContext()
    let q = DispatchQueue(label: "write", qos: .userInitiated, attributes: .concurrent)
    let group = DispatchGroup()
    var times: [Double] = []
    let lock = NSLock()
    func stream(_ stream: SCStream, didOutputSampleBuffer sb: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, let px = sb.imageBuffer else { return }
        // skip frames ScreenCaptureKit marks as unchanged or idle
        if let atts = CMSampleBufferGetSampleAttachmentsArray(sb, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
           let raw = atts.first?[.status] as? Int, let st = SCFrameStatus(rawValue: raw), st != .complete { return }
        var img = CIImage(cvPixelBuffer: px)
        if let c = crop {   // CIImage's origin is bottom-left; the crop is given from the top-left
            let h = img.extent.height
            img = img.cropped(to: CGRect(x: c.minX, y: h - c.maxY, width: c.width, height: c.height))
            img = img.transformed(by: CGAffineTransform(translationX: -c.minX, y: -(h - c.maxY)))
        }
        guard let cg = ctx.createCGImage(img, from: img.extent) else { return }
        lock.lock(); let i = n; n += 1; times.append(CMSampleBufferGetPresentationTimeStamp(sb).seconds); lock.unlock()
        group.enter()
        q.async {
            let url = URL(fileURLWithPath: String(format: "%@/c%05d.jpg", outDir, i))
            if let d = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) {
                CGImageDestinationAddImage(d, cg, [kCGImageDestinationLossyCompressionQuality: 0.95] as CFDictionary)
                CGImageDestinationFinalize(d)
            }
            self.group.leave()
        }
    }
}

let sem = DispatchSemaphore(value: 0)
Task {
    do {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
        let wins = content.windows.filter { $0.owningApplication?.processID == pid && $0.frame.width > 400 }
        guard let win = wins.max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) else {
            print("no window for pid \(pid)"); exit(1)
        }
        let filter = SCContentFilter(desktopIndependentWindow: win)
        let cfg = SCStreamConfiguration()
        let scale = Double(filter.pointPixelScale)
        cfg.width = Int(win.frame.width * scale); cfg.height = Int(win.frame.height * scale)
        cfg.minimumFrameInterval = CMTime(value: 1, timescale: 60)
        cfg.queueDepth = 8; cfg.showsCursor = false
        print("window \(win.windowID) \(Int(win.frame.width))x\(Int(win.frame.height)) pt, \(cfg.width)x\(cfg.height) px")
        if outDir == "list" { exit(0) }
        let sink = Sink()
        let stream = SCStream(filter: filter, configuration: cfg, delegate: nil)
        try stream.addStreamOutput(sink, type: .screen, sampleHandlerQueue: DispatchQueue(label: "cap"))
        try await stream.startCapture()
        // until the time is up, or until a file named "stop" appears in the output folder
        let started = Date()
        while Date().timeIntervalSince(started) < secs && !FileManager.default.fileExists(atPath: outDir + "/stop") {
            try await Task.sleep(nanoseconds: 200_000_000)
        }
        try await stream.stopCapture()
        sink.group.wait()
        let t0 = sink.times.first ?? 0
        try sink.times.map { String(format: "%.4f", $0 - t0) }.joined(separator: "\n").write(toFile: outDir + "/times.txt", atomically: true, encoding: .utf8)
        print("frames \(sink.n)")
    } catch { print("error: \(error)"); exit(1) }
    sem.signal()
}
sem.wait()
