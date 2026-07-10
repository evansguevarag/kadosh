"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const [position, setPosition] = useState<ToasterProps["position"]>("top-right")

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)")

    function updatePosition() {
      setPosition(mediaQuery.matches ? "bottom-center" : "top-right")
    }

    updatePosition()
    mediaQuery.addEventListener("change", updatePosition)

    return () => mediaQuery.removeEventListener("change", updatePosition)
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      duration={3600}
      gap={10}
      mobileOffset={{ bottom: "max(1rem, env(safe-area-inset-bottom))", left: 12, right: 12 }}
      offset={20}
      position={position}
      richColors={false}
      visibleToasts={3}
      icons={{
        success: (
          <span className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CircleCheckIcon className="size-4" />
          </span>
        ),
        info: (
          <span className="flex size-7 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <InfoIcon className="size-4" />
          </span>
        ),
        warning: (
          <span className="flex size-7 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <TriangleAlertIcon className="size-4" />
          </span>
        ),
        error: (
          <span className="flex size-7 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <OctagonXIcon className="size-4" />
          </span>
        ),
        loading: (
          <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Loader2Icon className="size-4 animate-spin" />
          </span>
        ),
        close: <XIcon className="size-3.5" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.75rem",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: "Cerrar notificación",
        classNames: {
          toast:
            "cn-toast !min-h-14 !rounded-xl !border-slate-200/80 !bg-white/95 !py-3 !pl-3.5 !pr-12 !text-slate-950 !shadow-[0_18px_50px_-20px_rgba(15,23,42,0.45)] !backdrop-blur-xl",
          content: "!gap-0.5",
          title: "!text-[13px] !font-semibold !leading-5",
          description: "!text-xs !leading-4 !text-slate-500",
          icon: "!mr-1 !size-7",
          closeButton:
            "!left-auto !right-3 !top-1/2 !size-7 !translate-x-0 !-translate-y-1/2 !border-0 !bg-slate-100 !text-slate-500 hover:!bg-slate-200 hover:!text-slate-800",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
