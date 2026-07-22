import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { readFile } from "node:fs/promises";

let cachedJwks: object | null = null;

async function loadJwksJson(): Promise<string> {
  const envVar = process.env.BLUESKY_OAUTH_PUBLIC_JWKS;
  if (envVar) return envVar;
  return readFile("./keys/public-jwks.json", "utf-8");
}

async function oauthJwksHandler(_req: Request, res: Response): Promise<void> {
  res.set("Content-Type", "application/json");

  if (!cachedJwks) {
    try {
      const raw = await loadJwksJson();
      cachedJwks = JSON.parse(raw) as object;
    } catch {
      res.status(500).json({ error: "Failed to load JWKS" });
      return;
    }
  }

  res.json(cachedJwks);
}

export const oauthJwks = onRequest(oauthJwksHandler);
export const oauthJwksStage = onRequest(oauthJwksHandler);
