import React, { useEffect, useRef, useState } from "react";
import { Loader2, Info } from "lucide-react";

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError: (error: any) => void;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);
  const [width, setWidth] = useState(320);

  // ResizeObserver to track container width exactly so GIS button fits perfectly
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) {
        setWidth(Math.floor(w));
      }
    });
    observer.observe(containerRef.current);
    const initialWidth = containerRef.current.offsetWidth;
    if (initialWidth) {
      setWidth(initialWidth);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

    if (!clientId) {
      console.warn("VITE_GOOGLE_CLIENT_ID is not set. Google Sign-In is disabled.");
      setIsConfigured(false);
      setLoading(false);
      return;
    }

    const initGoogle = () => {
      try {
        const google = (window as any).google;
        if (google?.accounts?.id) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: any) => {
              if (response.credential) {
                onSuccess(response.credential);
              } else {
                onError(new Error("No credential returned from Google."));
              }
            },
          });

          if (buttonRef.current) {
            buttonRef.current.innerHTML = ""; // Clear any previous rendering
            google.accounts.id.renderButton(buttonRef.current, {
              theme: "outline",
              size: "large",
              type: "standard",
              shape: "rectangular",
              text: "continue_with",
              width: width,
              logo_alignment: "left",
            });
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Google OAuth Init Error:", err);
        setIsConfigured(false);
        setLoading(false);
      }
    };

    if (!document.getElementById("google-gis-script")) {
      const script = document.createElement("script");
      script.id = "google-gis-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      script.onerror = () => {
        setIsConfigured(false);
        setLoading(false);
      };
      document.head.appendChild(script);
    } else {
      const checkAndInit = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(checkAndInit);
          initGoogle();
        }
      }, 100);
      return () => clearInterval(checkAndInit);
    }
  }, [onSuccess, onError, width]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center w-full text-[11px] text-zinc-400 font-medium border border-zinc-200/60 rounded-[12px] bg-white"
        style={{ height: 40 }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2 text-zinc-300" />
        Loading...
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="space-y-2 w-full">
        {/* Placeholder styled button when Google OAuth is not configured */}
        <div
          className="w-full flex items-center justify-center gap-2.5 rounded-[12px] border border-zinc-200/80 bg-white text-[12px] font-medium text-zinc-650 cursor-not-allowed select-none transition-colors hover:bg-zinc-50/50"
          style={{ height: 40 }}
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span style={{ fontFamily: "Roboto, arial, sans-serif", fontWeight: 500, color: "#1f1f1f" }}>Continue with Google</span>
        </div>

        <div
          className="rounded-xl p-3 text-[10px] text-zinc-400 flex items-start gap-2 leading-relaxed"
          style={{ border: "1px solid rgba(15,23,42,0.05)" }}
        >
          <Info className="h-3.5 w-3.5 shrink-0 text-zinc-300 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-500 block">
              Developer configuration needed
            </span>
            Set{" "}
            <code className="font-mono bg-zinc-150 px-1 py-px rounded text-zinc-700 text-[9px]">
              VITE_GOOGLE_CLIENT_ID
            </code>{" "}
            in environment variables to activate Google Sign-In.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      {/* Native Google Identity Services Button Wrapper without visual layout offset wrappers */}
      <div ref={buttonRef} className="w-full" style={{ height: 40 }} />
    </div>
  );
};
