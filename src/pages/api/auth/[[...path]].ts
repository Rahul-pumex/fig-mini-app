import type { NextApiRequest, NextApiResponse } from "next";
import { proxyRequest } from "../../../server/proxy";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { path } = req.query;

  const segments = Array.isArray(path)
    ? path
    : path
    ? [path]
    : [];

  const suffix = segments.join("/");

  const base =
    process.env.NEXT_PUBLIC_AUTH_DOMAIN || process.env.AUTH_DOMAIN;

  const targetPath = suffix ? `api/auth/${suffix}` : "api/auth";

  await proxyRequest(req, res, base, targetPath);
}


