"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label: string;
  rows?: number;
  className?: string;
};

type EmptyStateProps = {
  title: string;
  description?: string;
  className?: string;
};

export function LoadingState({
  className,
  label,
  rows = 4,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-slate-50/70 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>

      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="grid animate-pulse gap-3 sm:grid-cols-[1.3fr_1fr_0.8fr]"
          >
            <div className="h-4 rounded bg-slate-200" />
            <div className="h-4 rounded bg-slate-200" />
            <div className="h-4 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ className, description, title }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-slate-50 p-5 text-sm",
        className,
      )}
    >
      <p className="font-medium text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1 text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
