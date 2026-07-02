import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getAssetDiskPath, getAssetURL, mediaTypeToExt } from "./assets";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const videoMetaData = getVideo(cfg.db, videoId);
  if (!videoMetaData) {
    throw new NotFoundError("Video was not found")
  }
  if (videoMetaData.userID != userID) {
    throw new UserForbiddenError("This user have no access to this video");
  }

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  //  TODO: implement the upload here
  const result = await req.formData();
  const thumbnail = result.get("thumbnail");
  if (!(thumbnail instanceof File)) {
    throw new BadRequestError("Invalid thumbnail");
  }
  const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
  if (thumbnail.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Thumbnail file size is too heavy");
  }

  const mediaType = thumbnail.type;
  if (mediaType !== "image/jpeg" && mediaType !== "image/png") {
    throw new BadRequestError("Invalid file type. Only JPEG or PNG allowed.");
  }


  const ext = mediaTypeToExt(mediaType);
  const filename = `${videoId}${ext}`;
  const newDataFilePath = getAssetDiskPath(cfg, filename);
  await Bun.write(newDataFilePath, thumbnail);
  videoMetaData.thumbnailURL = getAssetURL(cfg, filename);
  updateVideo(cfg.db, videoMetaData);

  return respondWithJSON(200, videoMetaData);
}
