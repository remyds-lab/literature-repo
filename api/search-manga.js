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
    fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `query ($search: String) { Page(perPage: 50) { media(search: $search, type: MANGA) { title { romaji english native } description genres chapters coverImage { large medium } siteUrl startDate { year } } } }`, variables: { search: query } }),
    }).then(response => response.ok ? response.json() : Promise.reject(new Error(`AniList API returned ${response.status}`)))
      .then(data => data.data?.Page?.media || []),
    fetch(`https://kitsu.io/api/edge/manga?filter[text]=${encodedQuery}&page[limit]=25&include=coverImage`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Kitsu API returned ${response.status}`))),
  ];
  if (req.query.mode === 'author') {
    requests.push(fetch(`https://api.jikan.moe/v4/people?q=${encodedQuery}&limit=5`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Jikan people API returned ${response.status}`)))
      .then(data => Promise.all((data.data || []).map(person =>
        fetch(`https://api.jikan.moe/v4/people/${person.mal_id}/full`)
          .then(response => response.ok ? response.json() : Promise.reject(new Error(`Jikan person API returned ${response.status}`)))
      ))));
  }

  const [mangaUpdates, jikan, mangaDex, aniList, kitsu, authorSearch] = await Promise.allSettled(requests);
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

  if (aniList.status === 'fulfilled') {
    results.push(...aniList.value.map(manga => ({
      title: manga.title?.english || manga.title?.romaji || manga.title?.native || 'Sin título',
      description: manga.description?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
      genre: manga.genres?.join(', ') || '',
      chapters: Number.isFinite(Number(manga.chapters)) ? Number(manga.chapters) : null,
      image: manga.coverImage?.large || manga.coverImage?.medium || '', url: manga.siteUrl || '', type: 'Manga',
      year: manga.startDate?.year || '',
    })));
  }

  if (kitsu.status === 'fulfilled') {
    const included = new Map((kitsu.value.included || []).map(item => [item.id, item.attributes]));
    results.push(...(kitsu.value.data || []).map(manga => {
      const attributes = manga.attributes || {};
      const cover = included.get(manga.relationships?.coverImage?.data?.id)?.original || {};
      return {
        title: attributes.canonicalTitle || attributes.titles?.en || 'Sin título',
        description: attributes.synopsis?.replace(/<[^>]*>/g, '').slice(0, 200) || '', genre: '',
        chapters: Number.isFinite(Number(attributes.chapterCount)) ? Number(attributes.chapterCount) : null,
        image: cover.url || attributes.posterImage?.large || attributes.posterImage?.medium || '',
        url: `https://kitsu.io/manga/${manga.id}`, type: 'Manga', year: attributes.startDate?.slice(0, 4) || '',
      };
    }));
  }

  if (authorSearch?.status === 'fulfilled') {
    results.push(...authorSearch.value.flatMap(person => (person.data?.manga || []).map(manga => ({
      title: manga.title || 'Sin título',
      description: `Manga asociado al autor buscado${person.data?.name ? `: ${person.data.name}` : ''}`,
      genre: '', chapters: null,
      image: manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url || '',
      url: manga.url || '', type: 'Manga', year: '',
    }))));
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
