import React, { useEffect, useRef, useState } from "react";
import { Button, InlineError, Modal, inputCls } from "./ui.jsx";

export function CameraScanner({ open, onClose, onScan, t }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    setManual("");
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !("BarcodeDetector" in window)) {
        setError(t("scan.cameraUnsupported"));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector();
        const detect = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) { onScan(codes[0].rawValue); onClose(); return; }
          } catch (_) { /* ignore a transient unreadable frame */ }
          frameRef.current = requestAnimationFrame(detect);
        };
        detect();
      } catch (_) { setError(t("scan.cameraDenied")); }
    }
    start();
    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, t]);

  const submitManual = () => {
    const value = manual.trim();
    if (!value) return;
    onScan(value);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t("scan.cameraTitle")} description={t("scan.cameraBody")}
      footer={<Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>}>
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-[18%] border-2 border-white/80 rounded-lg pointer-events-none" />
        </div>
        {error ? <InlineError>{error}</InlineError> : null}
        <div className="flex gap-2">
          <input className={inputCls} value={manual} onChange={(e) => setManual(e.target.value)}
            placeholder={t("scan.placeholder")} onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }} />
          <Button variant="primary" onClick={submitManual} disabled={!manual.trim()}>{t("scan.useCode")}</Button>
        </div>
      </div>
    </Modal>
  );
}
