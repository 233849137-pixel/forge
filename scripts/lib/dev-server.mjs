export async function shouldStartLocalDevServer(url, fetcher = fetch) {
  try {
    const response = await fetcher(url);
    return !response.ok;
  } catch {
    return true;
  }
}
