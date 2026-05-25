async function fetchStartupNews(query = "Indian startup", pageSize = 5) {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return fallbackNews(query);
  try {
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("apiKey", key);
    url.searchParams.set("q", `${query} India`);
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", String(pageSize));
    const response = await fetch(url);
    const data = await response.json();
    return (data.articles || []).slice(0, pageSize).map(article => ({
      title: article.title,
      source: article.source?.name || "News",
      url: article.url,
      publishedAt: article.publishedAt,
      description: article.description || ""
    }));
  } catch {
    return fallbackNews(query);
  }
}

function fallbackNews(query) {
  return [
    {
      title: `${query} signals are active in India`,
      source: "ConnectHub AI",
      url: "https://www.startupindia.gov.in/",
      publishedAt: new Date().toISOString(),
      description: "Configure NewsAPI for live news. This fallback keeps the AI Hub usable."
    }
  ];
}

module.exports = { fetchStartupNews };
