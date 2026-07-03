import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import path from "path";
import { uploadVideoToS3 } from "../s3";
import { rm } from "fs/promises";


const MAX_UPLOAD_SIZE = 1 << 30;

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if(!videoId){
    throw new BadRequestError("Invalid video");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);
  if(!video){
    throw new NotFoundError("Video not found");
  }

  if(video.userID !== userID){
    throw new UserForbiddenError("User cannot access to this video");
  }
  const formData = await req.formData();
  if(!formData){
    throw new BadRequestError("No form data")
  }
  const file = formData.get("video");
  if(!file){
    throw new BadRequestError("")
  }

  if(!(file instanceof File)){
    throw new BadRequestError("Invalid type of file");
  }

  if(file.size > MAX_UPLOAD_SIZE){
    throw new BadRequestError("")
  }

  if(file.type !== "video/mp4"){
    throw new BadRequestError("");
  }

  const tempFilePath = path.join("/tmp", `${videoId}.mp4`);
  await Bun.write(tempFilePath, file);

  const key = `${videoId}.mp4`;
  await uploadVideoToS3(cfg, key, tempFilePath, "video/mp4");

  const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;
  video.videoURL = videoURL;
  updateVideo(cfg.db, video);

  await rm(tempFilePath, { force: true });

  return respondWithJSON(200, video);
}
