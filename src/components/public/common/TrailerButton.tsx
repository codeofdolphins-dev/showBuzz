"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface TrailerButtonProps {
  title: string;
  url: string;
  className?: string;
  children: ReactNode;
}

export function TrailerButton({ title, url, className, children }: TrailerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        sheetOnMobile={false}
        tone="dark"
        className="max-w-4xl overflow-hidden border border-slate-800 p-0 sm:p-0"
      >
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <h4 className="text-sm font-bold text-white">{title} - Official Trailer</h4>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close trailer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="aspect-video w-full bg-black">
          <iframe
            className="h-full w-full"
            src={`${url}?autoplay=1`}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </Modal>
    </>
  );
}
