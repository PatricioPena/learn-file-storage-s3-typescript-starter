import type { ApiConfig } from "./config";

export async function uploadVideoToS3(
    cfg: ApiConfig,
    key: string,
    processesFilePath: string,
    contentType: string,
) {
    const s3Reference = cfg.s3Client.file(key, {
        bucket: cfg.s3Bucket
    })
    const content = Bun.file(processesFilePath);
    await s3Reference.write(content , { type: contentType})
}
