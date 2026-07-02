import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here
  const result = await req.formData();
  const thumbnail = result.get("thumbnail");
  if(!(thumbnail instanceof File)){
    throw new BadRequestError("Invalid thumbnail");
  }
  const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
  if(thumbnail.size > MAX_UPLOAD_SIZE){
    throw new BadRequestError("Thumbnail file size is too heavy");
  }
  const thumbnailType = thumbnail.type;
  const thumbnailData = await thumbnail.arrayBuffer();
  
  const videoMetaData = getVideo(cfg.db, videoId);
  if(!videoMetaData){
    throw new NotFoundError("Video was not found")
  }
  if(videoMetaData.userID != userID){
    throw new UserForbiddenError("This user have no access to this video");
  }
  videoThumbnails.set(videoId, {
    data: thumbnailData,
    mediaType: thumbnailType
  })

  const thumbnailUrl = `http://localhost:${cfg.port}/api/thumbnails/${videoId}`
  videoMetaData.thumbnailURL = thumbnailUrl;
  updateVideo(cfg.db, videoMetaData);
  return respondWithJSON(200, videoMetaData);
}
