"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eraser, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signContract } from "@/lib/api/contract-signatures";

interface Props {
  contractId: string;
  templateId: string;
  html: string;
  alreadySigned: boolean;
  residentDisplayName: string;
}

/**
 * Mobile contract signer.
 *
 * Renders the contract body (read-only) followed by a signature canvas. The
 * resident draws with finger or pen, types their full name as supplementary
 * attestation, then submits.
 *
 * The canvas captures pointer events (works for touch + mouse + pen) and
 * exports a PNG data URL on submit. The currently-rendered HTML is sent along
 * so the signature is frozen against exactly the version the resident saw.
 */
export function MobileContractSignerClient({
  contractId,
  templateId,
  html,
  alreadySigned,
  residentDisplayName,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(residentDisplayName);
  const router = useRouter();

  // Initialize canvas (white bg + smooth line settings) on mount
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // High-DPI: scale internal resolution but keep CSS size
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0B1F3A";
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (alreadySigned) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    setIsDrawing(false);
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasInk(false);
  }

  function submit() {
    if (!hasInk) {
      toast.error("Please draw your signature first");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Please type your full name");
      return;
    }
    const png = canvasRef.current?.toDataURL("image/png");
    if (!png) return;

    startTransition(async () => {
      try {
        await signContract({
          contractId,
          templateId,
          renderedHtml: html,
          signaturePng: png,
          fullNameTyped: fullName.trim(),
        });
        toast.success("Contract signed");
        router.refresh();
      } catch (err) {
        toast.error("Sign failed", { description: err instanceof Error ? err.message : "Unknown" });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Contract body — read-only, scrollable on mobile */}
      <div
        className="rounded-xl border bg-white p-4 text-[13px] text-black"
        style={{ lineHeight: 1.5 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {alreadySigned ? null : (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            <p className="text-sm font-medium">Sign here</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Draw your signature using your finger, mouse, or pen. By signing, you confirm you have read and agree to all terms above.
          </p>

          <canvas
            ref={canvasRef}
            className="block h-40 w-full touch-none rounded-md border bg-white"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          <div className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={clearCanvas} disabled={pending} type="button">
              <Eraser className="h-3.5 w-3.5" />Clear
            </Button>
            <p className="text-[10px] text-muted-foreground self-center">
              {hasInk ? "Signature captured" : "Empty"}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="full-name">Type your full name</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Marius H. Djatto"
              disabled={pending}
            />
          </div>

          <Button onClick={submit} disabled={pending || !hasInk} className="w-full" type="button">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            {pending ? "Submitting…" : "Sign & submit"}
          </Button>
        </div>
      )}
    </div>
  );
}
