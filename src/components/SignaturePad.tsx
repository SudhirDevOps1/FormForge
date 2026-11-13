"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { PenToolIcon, RefreshCwIcon, TrashIcon, CheckCircleIcon } from "@/components/icons";

export interface SignaturePadProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  penColor?: string;
}

export function SignaturePad({
  value,
  onChange,
  required = false,
  disabled = false,
  label = "Digital Signature",
  penColor = "#38bdf8",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(Boolean(value));
  const [canUndo, setCanUndo] = useState(false);
  const historyRef = useRef<ImageData[]>([]);

  // Setup canvas with high-DPI scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set display size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // If value already provided (base64 PNG), draw it
      if (value) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, rect.width, rect.height);
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          setHasSignature(true);
        };
        img.src = value;
      }
    }
  }, [penColor, value]);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setupCanvas]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const saveHistoryState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current.push(snapshot);
      if (historyRef.current.length > 20) historyRef.current.shift();
      setCanUndo(true);
    } catch {
      /* ignore canvas access errors */
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    saveHistoryState();
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    setHasSignature(true);
    onChange(dataUrl);
  };

  const clearSignature = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    historyRef.current = [];
    setCanUndo(false);
    setHasSignature(false);
    onChange("");
  };

  const undoSignature = () => {
    if (disabled || historyRef.current.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const last = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    if (last) {
      ctx.putImageData(last, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      onChange(dataUrl);
      setHasSignature(true);
    } else {
      clearSignature();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <label className="font-bold text-white flex items-center gap-1.5">
          <PenToolIcon className="w-4 h-4 text-cyan-400" />
          <span>{label}</span>
          {required && <span className="text-cyan-400">*</span>}
        </label>
        <div className="flex items-center gap-2">
          {hasSignature && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <CheckCircleIcon className="w-3 h-3 text-emerald-400" />
              Signed
            </span>
          )}
          <button
            type="button"
            onClick={undoSignature}
            disabled={disabled || !canUndo}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-30 disabled:pointer-events-none transition"
            title="Undo last stroke"
          >
            <RefreshCwIcon className="w-3 h-3" />
            Undo
          </button>
          <button
            type="button"
            onClick={clearSignature}
            disabled={disabled || !hasSignature}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 disabled:pointer-events-none transition"
            title="Clear signature"
          >
            <TrashIcon className="w-3 h-3" />
            Clear
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl border border-white/15 bg-black/50 overflow-hidden shadow-inner group">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-36 cursor-crosshair touch-none select-none block"
          style={{ width: "100%", height: "144px" }}
        />

        {/* Signature Line Guideline */}
        <div className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-dashed border-white/10 flex items-center justify-between text-[10px] text-slate-600 font-mono">
          <span>x ________________________</span>
          <span>Legal E-Signature Stamp</span>
        </div>

        {!hasSignature && !isDrawing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-500 gap-1.5">
            <PenToolIcon className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition" />
            <span>Draw your signature with mouse, stylus, or fingertip</span>
          </div>
        )}
      </div>
    </div>
  );
}
