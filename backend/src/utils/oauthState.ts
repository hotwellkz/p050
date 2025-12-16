import crypto from "crypto";
import { Logger } from "./logger";

const STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || "default-secret-change-in-production";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 минут

export interface OAuthStateData {
  userId: string;
  returnTo?: string;
  nonce: string;
  timestamp: number;
}

/**
 * Генерирует подписанный state для OAuth
 * Формат: base64url(JSON({userId, returnTo, nonce, ts})) + "." + HMAC_SHA256
 */
export function generateOAuthState(data: OAuthStateData): string {
  const payload = {
    userId: data.userId,
    returnTo: data.returnTo || "/settings",
    nonce: data.nonce || crypto.randomBytes(16).toString("hex"),
    timestamp: data.timestamp || Date.now()
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const hmac = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(payloadBase64)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const state = `${payloadBase64}.${hmac}`;

  Logger.info("OAuth state generated", {
    userId: payload.userId,
    returnTo: payload.returnTo,
    stateLength: state.length,
    hasNonce: !!payload.nonce
  });

  return state;
}

/**
 * Валидирует и декодирует state
 * @throws Error если state невалиден или истёк
 */
export function validateOAuthState(state: string): OAuthStateData {
  if (!state || typeof state !== "string") {
    throw new Error("State is required");
  }

  const parts = state.split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid state format");
  }

  const [payloadBase64, signature] = parts;

  // Проверяем подпись
  const expectedHmac = crypto
    .createHmac("sha256", STATE_SECRET)
    .update(payloadBase64)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  if (signature !== expectedHmac) {
    Logger.error("OAuth state signature validation failed", {
      stateLength: state.length,
      hasSignature: !!signature
    });
    throw new Error("Invalid state signature");
  }

  // Декодируем payload
  let payloadJson: string;
  try {
    // Восстанавливаем padding если нужно
    const padding = (4 - (payloadBase64.length % 4)) % 4;
    const paddedBase64 = payloadBase64 + "=".repeat(padding);
    payloadJson = Buffer.from(paddedBase64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch (error) {
    Logger.error("Failed to decode OAuth state payload", { error });
    throw new Error("Invalid state payload");
  }

  let payload: OAuthStateData;
  try {
    payload = JSON.parse(payloadJson);
  } catch (error) {
    Logger.error("Failed to parse OAuth state JSON", { error });
    throw new Error("Invalid state JSON");
  }

  // Проверяем обязательные поля
  if (!payload.userId || !payload.timestamp || !payload.nonce) {
    throw new Error("Missing required state fields");
  }

  // Проверяем TTL
  const age = Date.now() - payload.timestamp;
  if (age > STATE_TTL_MS) {
    Logger.warn("OAuth state expired", {
      ageMs: age,
      ttlMs: STATE_TTL_MS,
      userId: payload.userId
    });
    throw new Error("State expired");
  }

  if (age < 0) {
    Logger.warn("OAuth state timestamp in future", {
      ageMs: age,
      userId: payload.userId
    });
    throw new Error("Invalid state timestamp");
  }

  Logger.info("OAuth state validated successfully", {
    userId: payload.userId,
    returnTo: payload.returnTo,
    ageMs: age
  });

  return payload;
}




