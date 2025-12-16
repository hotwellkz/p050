import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  getGoogleDriveStatus,
  disconnectGoogleDrive,
  type GoogleDriveIntegrationStatus
} from "../api/googleDriveIntegration";
import { SectionHelpButton } from "./aiAssistant/SectionHelpButton";

const GoogleDriveIntegration = () => {
  const [status, setStatus] = useState<GoogleDriveIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const currentStatus = await getGoogleDriveStatus();
      setStatus(currentStatus);
    } catch (err: any) {
      setError(err.message || "Не удалось загрузить статус");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    setError(null);
    // Прямой redirect на backend endpoint, который сделает redirect на Google OAuth
    // Cookie сессия будет отправлена автоматически браузером
    const returnTo = window.location.pathname;
    const backendUrl = import.meta.env.VITE_API_BASE_URL || "https://shortsai-backend-905027425668.us-central1.run.app";
    window.location.href = `${backendUrl}/api/auth/google/drive?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Вы уверены, что хотите отвязать Google Drive?")) {
      return;
    }

    try {
      setDisconnecting(true);
      setError(null);
      await disconnectGoogleDrive();
      await loadStatus();
    } catch (err: any) {
      setError(err.message || "Не удалось отвязать Google Drive");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-brand-light" />
      </div>
    );
  }

  const isConnected = status?.connected || false;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Google Drive интеграция</h3>
          <SectionHelpButton
            sectionKey="google_drive_integration"
            sectionTitle="Google Drive интеграция"
            currentStatus={isConnected ? "connected" : "not_connected"}
            context={{ email: status?.email }}
          />
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Привяжите свой Google Drive для автоматического сохранения видео
        </p>
      </div>

      {/* Статус */}
      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <div>
                <div className="font-medium text-white">✅ Привязан</div>
                {status?.email && (
                  <div className="text-sm text-slate-400">{status.email}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-slate-400" />
              <div className="font-medium text-white">❌ Не привязан</div>
            </>
          )}
        </div>
      </div>

      {/* Ошибки */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-900/20 p-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
          <div className="flex-1 text-sm text-red-300">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Кнопки управления */}
      {!isConnected ? (
        <button
          type="button"
          onClick={handleConnect}
          className="w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-dark"
        >
          Подключить Google Drive
        </button>
      ) : (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="w-full rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-2 font-semibold text-red-300 transition hover:bg-red-900/30 disabled:opacity-50"
        >
          {disconnecting ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Отвязка...
            </>
          ) : (
            "Отвязать Google Drive"
          )}
        </button>
      )}
    </div>
  );
};

export default GoogleDriveIntegration;

