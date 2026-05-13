"use client";

import { useState } from "react";
import Image from "next/image";
import { Download, QrCode } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VisitorQrProps {
  passCode: string;
  visitorName: string;
  scheduledDate: string;
}

/**
 * Renders a scannable QR for a visitor pass.
 *
 * Uses the free `api.qrserver.com` endpoint — generates a real QR PNG via URL.
 * No npm package needed. Encodes just the pass code (8 chars); the security
 * scanner app looks up the visitor record from that code server-side.
 */
export function VisitorQr({ passCode, visitorName, scheduledDate }: VisitorQrProps) {
  const [open, setOpen] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(passCode)}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
          <QrCode className="h-3.5 w-3.5" /> QR
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{visitorName}</DialogTitle>
          <DialogDescription>Show this QR at the gate · {scheduledDate}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`QR for ${passCode}`}
            width={320}
            height={320}
            className="rounded-md border bg-white"
          />
        </div>
        <p className="text-center font-mono text-lg font-bold tracking-widest">{passCode}</p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={qrUrl} download={`pass-${passCode}.png`}>
              <Download className="h-4 w-4" /> Download
            </a>
          </Button>
          <Button variant="default" onClick={() => setOpen(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Keep next/image import alive (used for future avatars/etc.)
export const _ImageNoop = Image;
