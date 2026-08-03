import { headers } from "next/headers";
import { siteUrlFromHeaders } from "./site-origin.ts";

export const SITE_NAME = "Bindery";
export const SITE_DESCRIPTION =
  "독립 창작자를 위한 행사 일정, 준비 노트, 공동구매 현황과 업계 소식.";

export async function getSiteUrl(): Promise<URL> {
  return siteUrlFromHeaders(await headers());
}
