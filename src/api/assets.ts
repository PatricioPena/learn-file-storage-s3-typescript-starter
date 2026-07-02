import { existsSync, mkdirSync } from "fs";

import type { ApiConfig } from "../config";
import path from 'node:path';

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}

export function getAssetDiskPath(cfg: ApiConfig, filename: string){
  const result = path.join(cfg.assetsRoot, filename);
  return result;
}

export function getAssetURL(cfg: ApiConfig, filename: string){
  const result = `http://localhost:${cfg.port}/assets/${filename}`
  return result
}

export function mediaTypeToExt(mediaType: string): string {
  const parts = mediaType.split("/");
  if (parts[1] === "jpeg") return ".jpg";
  return `.${parts[1]}`;
}