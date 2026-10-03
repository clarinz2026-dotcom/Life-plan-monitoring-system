import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

const DEFAULT_LOGO = "/logo.svg";

interface BrandLogoProps {
  className?: string;
  onClick?: () => void;
  title?: string;
}

/**
 * App logo that follows the logo configured on the Branding page in real time.
 * Falls back to the default bundled logo when none is set.
 * Also keeps the browser tab favicon in sync when a custom logo is configured.
 */
export function BrandLogo({ className = "h-8 w-8", onClick, title }: BrandLogoProps) {
  const settings = useQuery(api.settings.get);
  const logoUrl = settings?.logoUrl || DEFAULT_LOGO;

  // Keep the favicon in sync with a custom logo (only while a component using
  // the logo is mounted — e.g. inside the app layout or landing page).
  useEffect(() => {
    if (!settings) return;
    const href = settings.logoUrl || DEFAULT_LOGO;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [settings]);

  return (
    <img
      src={logoUrl}
      alt={title ?? "Evangelist Funeral Services logo"}
      title={title}
      onClick={onClick}
      className={`object-contain ${className}`}
    />
  );
}
