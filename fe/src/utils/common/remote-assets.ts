function isDataOrBlobUrl(url: string): boolean {
  return /^(?:data|blob):/i.test(url);
}

function isHttpUrl(url: string): boolean {
  if (!/^https?:\/\/[^/\\\s]+/i.test(url) || url.includes('\\')) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeRemoteAssetUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return '';
  }

  if (isDataOrBlobUrl(trimmedUrl)) {
    const separatorIndex = trimmedUrl.indexOf(':');

    return `${trimmedUrl.slice(0, separatorIndex).toLowerCase()}${trimmedUrl.slice(separatorIndex)}`;
  }

  if (!isHttpUrl(trimmedUrl)) {
    return trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    return parsedUrl.toString();
  } catch {
    return trimmedUrl;
  }
}
