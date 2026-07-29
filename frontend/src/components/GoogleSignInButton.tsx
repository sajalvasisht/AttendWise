import React, { useEffect, useRef, useState } from "react";
import { Loader2, Info } from "lucide-react";

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError: (error: any) => void;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onSuccess, onError }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);

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
            google.accounts.id.renderButton(buttonRef.current, {
              theme: "outline",
              size: "large",
              type: "standard",
              shape: "rectangular",
              text: "continue_with",
              width: buttonRef.current.clientWidth || 320,
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
  }, [onSuccess, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2.5 text-xs text-muted-foreground w-full bg-card border border-border rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground/60" /> 
        <span>Loading Google Authentication...</span>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="space-y-3 w-full animate-scale-in">
        <button
          type="button"
          disabled
          className="w-full rounded-lg border border-border/80 bg-card/50 py-2.5 px-4 text-xs font-bold text-muted-foreground/60 flex items-center justify-center space-x-2.5 cursor-not-allowed"
        >
          <svg className="h-4 w-4 shrink-0 opacity-40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="currentColor" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 12-4.53z" fill="currentColor" />
          </svg>
          <span>Google Sign-In Unavailable</span>
        </button>

        <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-[10px] text-muted-foreground flex items-start space-x-2.5 leading-relaxed">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground/80 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground block">Developer configuration needed</span>
            Google OAuth requires a valid Client ID. Set <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">VITE_GOOGLE_CLIENT_ID</code> in your frontend environment variables to enable it. Meanwhile, please sign in with an email account.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center border border-border rounded-lg bg-card overflow-hidden hover:bg-muted py-0.5 shadow-sm">
      <div ref={buttonRef} className="w-full" />
    </div>
  );
};
