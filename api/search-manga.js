// Vercel Serverless Function - Search multiple manga catalogs
// Endpoint: GET /api/search-manga?q=<query>

module.exports = async function handler(req, res) {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  const encodedQuery = encodeURIComponent(query);
  const requests = [
    fetch('https://api.mangaupdates.com/v1/series/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: query, per_page: 50 }),
    }).then(response => response.ok ? response.json() : Promise.reject(new Error(`MangaUpdates API returned ${response.status}`))),
    fetch(`https://api.jikan.moe/v4/manga?q=${encodedQuery}&limit=25`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Jikan API returned ${response.status}`))),
    fetch(`https://api.mangadex.org/manga?title=${encodedQuery}&limit=25&includes[]=cover_art`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`MangaDex API returned ${response.status}`))),
  ];

  const [mangaUpdates, jikan, mangaDex] = await Promise.allSettled(requests);
  const results = [];

  if (mangaUpdates.status === 'fulfilled') {
    results.push(...(mangaUpdates.value.results || []).map(result => {
      const series = result.record || {};
      return {
        title: series.title || 'Sin título',
        description: series.description ? series.description.replace(/<[^>]*>/g, '').slice(0, 200) : '',
        genre: Array.isArray(series.genres) ? series.genres.map(genre => typeof genre === 'string' ? genre : genre.name).filter(Boolean).join(', ') : '',
        chapters: Number.isFinite(Number(series.latest_chapter)) ? Number(series.latest_chapter) : null,
        image: series.image?.url?.original || '', url: series.url || '', type: series.type || 'Manga', year: series.year || '',
      };
    }));
  }

  if (jikan.status === 'fulfilled') {
    results.push(...(jikan.value.data || []).map(series => ({
      title: series.title || 'Sin título',
      description: series.synopsis?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
      genre: series.genres?.map(genre => genre.name).join(', ') || '',
      chapters: Number.isFinite(Number(series.chapters)) ? Number(series.chapters) : null,
      image: series.images?.jpg?.large_image_url || series.images?.jpg?.image_url || '', url: series.url || '', type: series.type || 'Manga', year: series.published?.from?.slice(0, 4) || '',
    })));
  }

  if (mangaDex.status === 'fulfilled') {
    results.push(...(mangaDex.value.data || []).map(manga => {
      const title = manga.attributes?.title || {};
      const description = manga.attributes?.description || {};
      const cover = manga.relationships?.find(item => item.type === 'cover_art');
      const fileName = cover?.attributes?.fileName;
      return {
        title: title.en || title.es || Object.values(title)[0] || 'Sin título',
        description: description.en || description.es || Object.values(description)[0] || '',
        genre: manga.attributes?.tags?.map(tag => tag.attributes?.name?.en || tag.attributes?.name?.es).filter(Boolean).join(', ') || '',
        chapters: Number.isFinite(Number(manga.attributes?.lastChapter)) ? Number(manga.attributes.lastChapter) : null,
        image: fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg` : '', url: `https://mangadex.org/title/${manga.id}`, type: 'Manga', year: manga.attributes?.year || '',
      };
    }));
  }

  const uniqueResults = [];
  const seenTitles = new Set();
  for (const result of results) {
    const key = result.title.trim().toLowerCase();
    if (!seenTitles.has(key)) { seenTitles.add(key); uniqueResults.push(result); }
    if (uniqueResults.length >= 75) break;
  }

  res.status(200).json({ source: 'multiple-catalogs', results: uniqueResults });
};
