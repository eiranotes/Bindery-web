export function safeCommunityReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/community";
  }

  return value;
}
