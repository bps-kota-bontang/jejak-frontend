import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearAuthSession, startSSOLogin } from "@/services/auth";
import { useAuth } from "@/providers/AuthProvider";

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithSSO } = useAuth();

  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const state = useMemo(() => searchParams.get("state")?.trim() || "", [searchParams]);

  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !state) {
      return;
    }

    let active = true;

    const executeCallback = async () => {
      setIsProcessingCallback(true);
      setError(null);

      try {
        await loginWithSSO({ token, state });
        if (active) {
          navigate("/surveys", { replace: true });
        }
      } catch (err) {
        if (!active) {
          return;
        }

        const message = err instanceof Error ? err.message : "Gagal masuk. Silakan coba lagi.";
        setError(message);
      } finally {
        if (active) {
          setIsProcessingCallback(false);
        }
      }
    };

    void executeCallback();

    return () => {
      active = false;
    };
  }, [navigate, state, token]);

  function handleStartSSOLogin() {
    clearAuthSession();
    startSSOLogin();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-lg border-border/70">
        <CardHeader className="bg-linear-to-br from-stone-100 via-orange-50 to-emerald-100">
          <CardDescription className="text-primary text-[11px] font-bold tracking-[0.08em] uppercase">
            Jejak Survey Dashboard
          </CardDescription>
          <CardTitle className="font-serif text-3xl">Masuk</CardTitle>
          <CardDescription>
            Masuk menggunakan akun BPS Anda untuk melanjutkan.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          <Button
            type="button"
            className="w-full"
            disabled={isProcessingCallback}
            onClick={handleStartSSOLogin}
          >
            {isProcessingCallback ? "Sedang masuk..." : "Masuk"}
          </Button>

          {(token || state) && !isProcessingCallback && (
            <p className="text-muted-foreground text-xs">
              Sedang menyelesaikan proses masuk. Jika belum berhasil, klik tombol masuk lagi.
            </p>
          )}

          {error && <p className="text-xs text-rose-700">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
};

export default LoginPage;