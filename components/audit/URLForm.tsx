"use client";

import { useState } from "react";
import { ArrowRight, Laptop, Smartphone } from "lucide-react";
import clsx from "clsx";
import type { Device } from "@/types/audit";

interface URLFormProps {
  onSubmit: (url: string, device: Device) => void;
  isBusy?: boolean;
  size?: "lg" | "md";
}

export function URLForm({ onSubmit, isBusy, size = "lg" }: URLFormProps) {
  const [value, setValue] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const looksInvalid = touched && trimmed.length > 0 && !/^https?:\/\/.+\..+/.test(trimmed);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    let candidate = trimmed;
    if (candidate && !/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    if (!candidate || !/^https?:\/\/.+\..+/.test(candidate)) return;
    onSubmit(candidate, device);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={clsx(
          "flex flex-col sm:flex-row items-stretch gap-2 rounded-2xl border bg-surface p-2 shadow-sm transition-colors",
          looksInvalid ? "border-red-400" : "border-border-subtle focus-within:border-accent"
        )}
      >
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="https://example.com"
          aria-label="Website URL to analyze"
          disabled={isBusy}
          className={clsx(
            "flex-1 bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-foreground/35 mono",
            size === "lg" ? "sm:text-lg" : "sm:text-base"
          )}
        />
        <div className="flex items-center gap-2 px-1 sm:px-0">
          <div className="flex items-center rounded-xl border border-border-subtle p-1 bg-background/50">
            <DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")} icon={<Laptop size={15} />} label="Desktop" />
            <DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")} icon={<Smartphone size={15} />} label="Mobile" />
          </div>
          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-accent px-5 py-3.5 font-medium text-accent-foreground transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
          >
            {isBusy ? "Analyzing…" : "Analyze Website"}
            {!isBusy && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
      {looksInvalid && <p className="mt-2 text-sm text-red-500">Enter a full URL, like https://example.com</p>}
    </form>
  );
}

function DeviceButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={clsx(
        "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-foreground/50 hover:text-foreground"
      )}
    >
      {icon}
    </button>
  );
}
