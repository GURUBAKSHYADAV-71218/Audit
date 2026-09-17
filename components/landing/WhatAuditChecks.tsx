import { Image, Braces, Paintbrush, Type, Network, Boxes, Database, Archive, Gauge } from "lucide-react";
import { Card } from "@/components/ui/Card";

const CHECKS = [
  { icon: Image, title: "Images", desc: "Format, size, and whether images are oversized for how they're displayed." },
  { icon: Braces, title: "JavaScript", desc: "Bundle size, render-blocking scripts, and third-party script weight." },
  { icon: Paintbrush, title: "CSS", desc: "Stylesheet size, count, and render-blocking behavior." },
  { icon: Type, title: "Fonts", desc: "Font file count, format, and loading strategy." },
  { icon: Network, title: "Network", desc: "Request count, slow requests, and overall transfer size." },
  { icon: Boxes, title: "Third-party resources", desc: "Analytics, ads, chat widgets, and other external scripts." },
  { icon: Database, title: "Caching", desc: "Whether static assets are cached effectively for repeat visits." },
  { icon: Archive, title: "Compression", desc: "Whether text responses use gzip or Brotli compression." },
  { icon: Gauge, title: "Core performance metrics", desc: "LCP, FCP, and CLS, measured directly in a real browser." },
];

export function WhatAuditChecks() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">What AUDIT checks</h2>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CHECKS.map((c) => (
          <Card key={c.title} className="p-5">
            <c.icon size={18} className="mb-3 text-accent" />
            <p className="font-medium">{c.title}</p>
            <p className="mt-1 text-sm text-foreground/50">{c.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
