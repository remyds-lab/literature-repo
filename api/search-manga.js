// Vercel Serverless Function - Search MangaUpdates with public fallbacks
// Endpoint: GET /api/search-manga?q=<query>

module.exports = async function handler(req, res) {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  try {
    const response = await fetch('https://api.mangaupdates.com/v1/series/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: query, per_page: 20 }),
    });
    if (!response.ok) throw new Error(`MangaUpdates API returned ${response.status}`);

    const data = await response.json();
    const results = (data.results || []).map(result => {
      const series = result.record || {};
      return {
        title: series.title || 'Sin título',
        description: series.description ? series.description.replace(/<[^>]*>/g, '').slice(0, 200) : '',
        genre: Array.isArray(series.genres) ? series.genres.map(genre => typeof genre === 'string' ? genre : genre.name).filter(Boolean).join(', ') : '',
        chapters: Number.isFinite(Number(series.latest_chapter)) ? Number(series.latest_chapter) : null,
        pages: null,
        image: series.image?.url?.original || '',
        url: series.url || '',
        type: series.type || 'Manga',
        year: series.year || '',
      };
    });

    return res.status(200).json({ source: 'mangaupdates', results });
  } catch (mangaUpdatesError) {
    console.error('MangaUpdates search error:', mangaUpdatesError);
  }

  try {
    const response = await fetch(
      `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=20`
    );

    if (!response.ok) {
      throw new Error(`Jikan API returned ${response.status}`);
    }

    const data = await response.json();
    const results = (data.data || []).map(series => ({
      title: series.title || 'Sin título',
      description: series.synopsis
        ? series.synopsis.replace(/<[^>]*>/g, '').slice(0, 200)
        : '',
      genre: series.genres?.map(genre => genre.name).join(', ') || '',
      chapters: Number.isFinite(Number(series.chapters)) ? Number(series.chapters) : null,
      pages: null,
      image: series.images?.jpg?.large_image_url || series.images?.jpg?.image_url || '',
      url: series.url || '',
      type: series.type || 'Manga',
      year: series.published?.from?.slice(0, 4) || '',
    }));

    res.status(200).json({ source: 'jikan', results });
  } catch (err) {
    console.error('Jikan search error:', err);
    try {
      const response = await fetch(
        `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=20&includes[]=cover_art`
      );
      if (!response.ok) throw new Error(`MangaDex API returned ${response.status}`);

      const data = await response.json();
      const results = (data.data || []).map(manga => {
        const title = manga.attributes?.title || {};
        const description = manga.attributes?.description || {};
        const cover = manga.relationships?.find(item => item.type === 'cover_art');
        const fileName = cover?.attributes?.fileName;

        return {
          title: title.en || title.es || Object.values(title)[0] || 'Sin título',
          description: description.en || description.es || Object.values(description)[0] || '',
          genre: manga.attributes?.tags?.map(tag => tag.attributes?.name?.en || tag.attributes?.name?.es).filter(Boolean).join(', ') || '',
          chapters: Number.isFinite(Number(manga.attributes?.lastChapter)) ? Number(manga.attributes.lastChapter) : null,
          pages: null,
          image: fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg` : '',
          url: `https://mangadex.org/title/${manga.id}`,
          type: 'Manga',
          year: manga.attributes?.year || '',
        };
      });

      res.status(200).json({ source: 'mangadex', results });
    } catch (fallbackError) {
      console.error('MangaDex search error:', fallbackError);
      res.status(200).json({ source: 'manga', results: [] });
    }
  }
};
