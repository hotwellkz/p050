import { Router } from "express";
import { Logger } from "../utils/logger";
import { validateOAuthState } from "../utils/oauthState";
import { handleOAuthCallback } from "../services/GoogleDriveOAuthService";

const router = Router();

/**
 * GET /api/integrations/google-drive/callback?code=...&state=...
 * Обрабатывает callback от Google OAuth (GET запрос от Google)
 * Валидирует state, обменивает code на tokens, сохраняет интеграцию и редиректит на returnTo
 */
router.get("/callback", async (req, res) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "https://shortsai.ru";
  
  try {
    const { code, state, error: oauthError } = req.query;
    
    Logger.info("GET /api/integrations/google-drive/callback: Request received", {
      requestId,
      hasCode: !!code,
      hasState: !!state,
      hasError: !!oauthError,
      query: req.query,
      headers: {
        "user-agent": req.headers["user-agent"],
        "referer": req.headers["referer"]
      }
    });

    // Проверяем ошибку от Google
    if (oauthError) {
      Logger.error("GET /api/integrations/google-drive/callback: OAuth error from Google", {
        requestId,
        error: oauthError,
        query: req.query
      });
      
      const returnTo = "/settings?drive=error";
      const redirectUrl = `${frontendOrigin}${returnTo}`;
      Logger.info("GET /api/integrations/google-drive/callback: Redirecting to frontend (error)", {
        requestId,
        redirectUrl
      });
      return res.redirect(redirectUrl);
    }

    // Проверяем наличие code и state
    if (!code || typeof code !== "string") {
      Logger.error("GET /api/integrations/google-drive/callback: Missing code", {
        requestId,
        hasCode: !!code,
        codeType: typeof code
      });
      
      const returnTo = "/settings?drive=error&reason=missing_code";
      const redirectUrl = `${frontendOrigin}${returnTo}`;
      return res.redirect(redirectUrl);
    }

    if (!state || typeof state !== "string") {
      Logger.error("GET /api/integrations/google-drive/callback: Missing state", {
        requestId,
        hasState: !!state,
        stateType: typeof state
      });
      
      const returnTo = "/settings?drive=error&reason=missing_state";
      const redirectUrl = `${frontendOrigin}${returnTo}`;
      return res.redirect(redirectUrl);
    }

    // Валидируем state
    let stateData;
    try {
      stateData = validateOAuthState(state);
      Logger.info("GET /api/integrations/google-drive/callback: State validated", {
        requestId,
        userId: stateData.userId,
        returnTo: stateData.returnTo
      });
    } catch (stateError: any) {
      Logger.error("GET /api/integrations/google-drive/callback: State validation failed", {
        requestId,
        error: stateError?.message || String(stateError),
        stateLength: state.length
      });
      
      const returnTo = "/settings?drive=error&reason=invalid_state";
      const redirectUrl = `${frontendOrigin}${returnTo}`;
      return res.redirect(redirectUrl);
    }

    const { userId, returnTo } = stateData;

    // Обрабатываем callback
    try {
      const result = await handleOAuthCallback(userId, code, requestId);
      
      Logger.info("GET /api/integrations/google-drive/callback: Integration connected successfully", {
        requestId,
        userId,
        email: result.email,
        returnTo,
        hasAccessToken: true,
        hasRefreshToken: true
      });

      // Редиректим на фронтенд с успешным статусом
      const successReturnTo = returnTo || "/settings";
      const redirectUrl = `${frontendOrigin}${successReturnTo}${successReturnTo.includes("?") ? "&" : "?"}drive=connected`;
      
      Logger.info("GET /api/integrations/google-drive/callback: Redirecting to frontend (success)", {
        requestId,
        userId,
        redirectUrl,
        finalDestination: successReturnTo
      });
      
      return res.redirect(redirectUrl);
    } catch (callbackError: any) {
      Logger.error("GET /api/integrations/google-drive/callback: Callback processing failed", {
        requestId,
        userId,
        error: callbackError?.message || String(callbackError),
        errorStack: callbackError?.stack,
        errorCode: callbackError?.code
      });

      const errorReturnTo = returnTo || "/settings";
      const redirectUrl = `${frontendOrigin}${errorReturnTo}${errorReturnTo.includes("?") ? "&" : "?"}drive=error&reason=oauth`;
      
      Logger.info("GET /api/integrations/google-drive/callback: Redirecting to frontend (error)", {
        requestId,
        userId,
        redirectUrl,
        finalDestination: errorReturnTo,
        errorReason: "oauth"
      });
      
      return res.redirect(redirectUrl);
    }
  } catch (error: any) {
    Logger.error("GET /api/integrations/google-drive/callback: Unexpected error", {
      requestId,
      error: error?.message || String(error),
      errorStack: error?.stack
    });
    
    const redirectUrl = `${frontendOrigin}/settings?drive=error&reason=unexpected`;
    return res.redirect(redirectUrl);
  }
});

export default router;



