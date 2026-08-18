import React, { useEffect, useRef, useState } from "react";

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
        if (google?.accounts?.id && buttonRef.current) {
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

          buttonRef.current.innerHTML = "";
          google.accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            type: "standard",
            shape: "rectangular",
            text: "continue_with",
            width: width || 320,
            logo_alignment: "left",
          });
          setLoading(false);
        }
      } catch (err) {
        console.error("Google OAuth Init Error:", err);
        setIsConfigured(false);
        setLoading(false);
      }
    };

    // If GIS script already loaded in window, initialize synchronously immediately (0ms delay)
    if ((window as any).google?.accounts?.id) {
      initGoogle();
      return;
    }

    let checkInterval: any = null;
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
      // Short 20ms check interval for instant binding
      checkInterval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(checkInterval);
          initGoogle();
        }
      }, 20);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [onSuccess, onError, width]);

  if (!isConfigured) {
    return (
      <div className="space-y-2 w-full">
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
          <span style={{ fontFamily: "Roboto, sans-serif", fontWeight: 500, color: "#1f1f1f" }}>Continue with Google</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full relative min-h-[40px]">
      {loading && (
        <div
          className="w-full flex items-center justify-center gap-2.5 rounded-[12px] border border-zinc-200/80 bg-white text-[12px] font-medium text-zinc-700 select-none absolute inset-0 z-0"
          style={{ height: 40 }}
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span style={{ fontFamily: "Roboto, sans-serif", fontWeight: 500, color: "#1f1f1f" }}>Continue with Google</span>
        </div>
      )}
      <div ref={buttonRef} className="w-full relative z-10" style={{ height: 40 }} />
    </div>
  );
};
