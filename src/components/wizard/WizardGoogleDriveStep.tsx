import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  getGoogleDriveStatus,
  type GoogleDriveIntegrationStatus
} from "../../api/googleDriveIntegration";
import { FieldHelpIcon } from "../aiAssistant/FieldHelpIcon";

interface WizardGoogleDriveStepProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export function WizardGoogleDriveStep({ onComplete, onSkip }: WizardGoogleDriveStepProps) {
  const [status, setStatus] = useState<GoogleDriveIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    // Если Google Drive уже подключен, автоматически переходим к следующему шагу
    if (status?.connected) {
      // Небольшая задержка для лучшего UX
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [status?.connected, onComplete]);

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
    setConnecting(true);
    setError(null);
    // Прямой redirect на backend endpoint, который сделает redirect на Google OAuth
    // Cookie сессия будет отправлена автоматически браузером
    const returnTo = "/channels/new";
    const backendUrl = import.meta.env.VITE_API_BASE_URL || "https://shortsai-backend-905027425668.us-central1.run.app";
    window.location.href = `${backendUrl}/api/auth/google/drive?returnTo=${encodeURIComponent(returnTo)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-brand-light" />
      </div>
    );
  }

  // Если уже подключен, показываем успешное сообщение
  if (status?.connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <div>
            <div className="font-medium text-white">✅ Google Drive успешно подключён</div>
            {status?.email && (
              <div className="text-sm text-slate-400">{status.email}</div>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-400">Переходим к следующему шагу...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold md:text-lg">Подключение Google Drive</h3>
        <FieldHelpIcon
          fieldKey="wizard.google_drive_connection"
          page="wizard"
          channelContext={{
            step: "google_drive_connection",
            context: "wizard"
          }}
          label="Подключение Google Drive"
        />
      </div>
      <p className="text-xs text-slate-400 md:text-sm">
        Привяжите свой Google Drive для автоматического сохранения видео. Это необходимо для работы с папками канала.
      </p>

      {/* Статус интеграции */}
      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
        {status?.connected ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div className="flex-1">
              <div className="font-medium text-white">Статус: Google Drive подключён</div>
              {status.email && (
                <div className="text-sm text-slate-400">{status.email}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-slate-400" />
            <div className="font-medium text-white">Статус: Google Drive не привязан</div>
          </div>
        )}
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

      {/* Кнопка подключения */}
      {!status?.connected && (
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
        >
          {connecting ? (
            <>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Подключение...
            </>
          ) : (
            "Подключить Google Drive"
          )}
        </button>
      )}

      {/* Кнопка пропуска (опционально) */}
      {onSkip && !status?.connected && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full rounded-lg border border-white/20 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700/50"
        >
          Пропустить (можно подключить позже)
        </button>
      )}
    </div>
  );
}

