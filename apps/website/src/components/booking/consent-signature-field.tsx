"use client";

import { useEffect, useRef } from "react";

/** Canvas signature pad that syncs PNG data-URL into a hidden form field. */
export function ConsentSignatureField({
  name = "consent_signature_png",
  required = true,
  label = "Owner signature",
  hint = "Sign with your finger or mouse. Required for compliance.",
}: {
  name?: string;
  required?: boolean;
  label?: string;
  hint?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0e3d34";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function syncHidden() {
    const canvas = canvasRef.current;
    if (!canvas || !hiddenRef.current) return;
    // Treat near-blank as empty
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! < 250 || data[i + 1]! < 250 || data[i + 2]! < 250) ink += 1;
    }
    hiddenRef.current.value = ink > 40 ? canvas.toDataURL("image/png") : "";
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (hiddenRef.current) hiddenRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
          <p className="text-xs text-on-surface-variant">{hint}</p>
        </div>
        <button type="button" onClick={clear} className="text-xs font-bold text-primary underline-offset-2 hover:underline">
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={560}
        height={160}
        className="h-36 w-full touch-none rounded-xl border border-outline-variant/40 bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!ctx) return;
          canvas?.setPointerCapture(e.pointerId);
          const { x, y } = pointerPos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current?.getContext("2d");
          if (!ctx) return;
          const { x, y } = pointerPos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          syncHidden();
        }}
        onPointerCancel={() => {
          drawing.current = false;
          syncHidden();
        }}
      />
      <input ref={hiddenRef} type="hidden" name={name} required={required} />
    </div>
  );
}
