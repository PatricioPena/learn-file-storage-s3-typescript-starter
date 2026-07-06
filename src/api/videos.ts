import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo, type Video } from "../db/videos";
import path, { parse } from "path";
import { uploadVideoToS3 } from "../s3";
import { rm } from "fs/promises";


const MAX_UPLOAD_SIZE = 1 << 30;

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError("User cannot access to this video");
  }
  const formData = await req.formData();
  if (!formData) {
    throw new BadRequestError("No form data")
  }
  const file = formData.get("video");
  if (!file) {
    throw new BadRequestError("")
  }

  if (!(file instanceof File)) {
    throw new BadRequestError("Invalid type of file");
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("")
  }

  if (file.type !== "video/mp4") {
    throw new BadRequestError("");
  }

  const tempFilePath = path.join("/tmp", `${videoId}.mp4`);
  await Bun.write(tempFilePath, file);

  const outputFile = await processVideoForFastStart(tempFilePath);

  const landscape = await getVideoAspectRadio(outputFile);
  const key = `${landscape}/${videoId}.mp4`;
  await uploadVideoToS3(cfg, key, outputFile, "video/mp4");

  //const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;
  const videoURL = `${cfg.s3CfDistribution}/${key}`;
  video.videoURL = videoURL;
  updateVideo(cfg.db, video);

  await rm(tempFilePath, { force: true });
  await rm(outputFile, { force: true });
  //const signedVideo = await dbVideoToSignedVideo(cfg, video);

  //return respondWithJSON(200, signedVideo);
  return respondWithJSON(200, video);
}



export async function getVideoAspectRadio(filepath: string) {
  const ffprobe = Bun.spawn({
    cmd: ["ffprobe", "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height", "-of", "json", filepath]
  });

  const stdoutText = await new Response(ffprobe.stdout).text();
  const stderrText = await new Response(ffprobe.stderr).text();
  const exitCode = await ffprobe.exited;
  if (exitCode !== 0) {
    throw new Error("")
  }
  const parsedOut = JSON.parse(stdoutText);
  const width = parsedOut.streams[0].width;
  const height = parsedOut.streams[0].height;
  const value = width / height;
  let ratio;
  if (1.7 < value && value < 1.8) {
    ratio = "landscape"
  }
  else if (0.56 < value && value < 0.6) {
    ratio = "portrait"
  }
  else {
    ratio = "other"
  }
  return ratio;
}

export async function processVideoForFastStart(inputFilePath: string) {
  const outputFilePath = `${inputFilePath}.processed`;
  const ffmpeg = Bun.spawn({
    cmd: ["ffmpeg", "-i", inputFilePath, "-movflags", "faststart", "-map_metadata",
      "0", "-codec", "copy", "-f", "mp4", outputFilePath]
  });
  const exitCode = await ffmpeg.exited;
  if (exitCode !== 0) {
    throw new Error("")
  }
  return outputFilePath;
}
