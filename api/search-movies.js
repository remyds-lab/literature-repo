// Vercel Serverless Function - Search TMDB with OMDb fallback
// Endpoint: GET /api/search-movies?q=<query>
// TMDB_API_KEY is recommended. OMDB_API_KEY remains a fallback.

module.exports = async function handler(req, res) {
  const query = String(req.query?.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  const tmdbKey = process.env.TMDB_API_KEY;
  const omdbKey = process.env.OMDB_API_KEY;
  const mode = ['director', 'actor'].includes(req.query?.mode) ? req.query.mode : 'title';
  const encodedQuery = encodeURIComponent(query);
  const tmdbGenres = {
    28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen',
    99: 'Documental', 18: 'Drama', 10751: 'Familia', 14: 'Fantasía', 36: 'Historia',
    27: 'Terror', 10402: 'Música', 9648: 'Misterio', 10749: 'Romance',
    878: 'Ciencia ficción', 10770: 'Película de TV', 53: 'Suspenso', 10752: 'Bélica', 37: 'Western',
  };

  const requests = [];
  if (tmdbKey) {
    requests.push(Promise.all([1, 2].map(page =>
      fetchWithTimeout(`https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(tmdbKey)}&language=es-ES&query=${encodeURIComponent(query)}&page=${page}`)
        .then(response => response.ok ? response.json() : Promise.reject(new Error(`TMDB API returned ${response.status}`)))
    )).then(pages => pages.flatMap(page => page.results || [])));
    if (mode !== 'title') {
      requests.push(fetchWithTimeout(`https://api.themoviedb.org/3/search/person?api_key=${encodeURIComponent(tmdbKey)}&language=es-ES&query=${encodeURIComponent(query)}`)
        .then(response => response.ok ? response.json() : Promise.reject(new Error(`TMDB people API returned ${response.status}`)))
        .then(data => Promise.all((data.results || []).slice(0, 5).map(person =>
          fetchWithTimeout(`https://api.themoviedb.org/3/person/${person.id}/combined_credits?api_key=${encodeURIComponent(tmdbKey)}&language=es-ES`)
            .then(response => response.ok ? response.json() : Promise.reject(new Error(`TMDB credits API returned ${response.status}`)))
            .then(credits => mode === 'actor'
              ? (credits.cast || [])
              : (credits.crew || []).filter(credit => credit.job === 'Director'))
        )).then(credits => credits.flat())));
    }
  }
  if (omdbKey) {
    requests.push(fetchWithTimeout(`https://www.omdbapi.com/?apikey=${encodeURIComponent(omdbKey)}&s=${encodeURIComponent(query)}&type=&r=json`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`OMDB API returned ${response.status}`)))
      .then(data => data.Response === 'False' ? [] : (data.Search || []).map(item => ({
        title: item.Title || 'Sin título', description: `${item.Type || ''} · ${item.Year || ''}`.trim(),
        image: item.Poster && item.Poster !== 'N/A' ? item.Poster : '', url: `https://www.imdb.com/title/${item.imdbID}`,
        type: item.Type === 'series' ? 'Series' : 'Movie', year: item.Year || '',
      }))));
  }
  requests.push(fetchWithTimeout(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`)
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`TVMaze API returned ${response.status}`)))
    .then(data => (data || []).slice(0, 40).map(item => ({
      title: item.show?.name || 'Sin título', description: item.show?.summary?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
      genre: item.show?.genres?.join(', ') || '', chapters: null, image: item.show?.image?.original || item.show?.image?.medium || '',
      url: item.show?.url || '', type: 'Series', year: item.show?.premiered?.slice(0, 4) || '',
    }))));
  requests.push(fetchWithTimeout(`https://v3.sg.media-imdb.com/suggestion/x/${encodedQuery}.json`)
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`IMDb API returned ${response.status}`)))
    .then(data => (data.d || []).slice(0, 40).map(item => ({
      title: item.l || 'Sin título', description: item.s || '', genre: '', chapters: null,
      image: item.i?.imageUrl || '', url: item.id ? `https://www.imdb.com/title/${item.id}/` : '',
      type: item.q?.toLowerCase().includes('series') || item.q?.toLowerCase().includes('tv') ? 'Series' : 'Movie', year: item.y || '',
    }))));
  if (mode !== 'title') {
    requests.push(fetchWithTimeout(`https://api.tvmaze.com/search/people?q=${encodeURIComponent(query)}`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`TVMaze people API returned ${response.status}`)))
      .then(people => Promise.all((people || []).slice(0, 5).map(person =>
        fetchWithTimeout(`https://api.tvmaze.com/people/${person.person.id}?embed=${mode === 'actor' ? 'castcredits' : 'crewcredits'}`)
          .then(response => response.ok ? response.json() : Promise.reject(new Error(`TVMaze credits API returned ${response.status}`)))
          .then(personData => {
            const credits = personData._embedded?.[mode === 'actor' ? 'castcredits' : 'crewcredits'] || [];
            return credits.map(credit => credit._embedded?.show || credit.show).filter(Boolean).map(show => ({
              title: show.name || 'Sin título', description: show.summary?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
              genre: show.genres?.join(', ') || '', chapters: null,
              image: show.image?.original || show.image?.medium || '', url: show.url || '', type: 'Series',
              year: show.premiered?.slice(0, 4) || '',
            }));
          })
      )).then(credits => credits.flat())));
  }

  const responses = await Promise.allSettled(requests);
  const results = responses.filter(response => response.status === 'fulfilled').flatMap(response => response.value)
    .filter(item => item.type === 'Movie' || item.type === 'Series' || item.media_type === 'movie' || item.media_type === 'tv')
    .map(item => item.media_type ? ({
          title: item.title || item.name || 'Sin título',
          description: item.overview || '',
          genre: item.genre_ids?.map(id => tmdbGenres[id]).filter(Boolean).join(', ') || '',
          chapters: null,
          image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
          url: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
          type: item.media_type === 'tv' ? 'Series' : 'Movie',
          year: (item.release_date || item.first_air_date || '').slice(0, 4),
        }) : item);

  const uniqueResults = [];
  const seenTitles = new Set();
  for (const result of results) {
    const key = String(result.title || '').trim().toLowerCase();
    if (!key) continue;
    if (!seenTitles.has(key)) { seenTitles.add(key); uniqueResults.push(result); }
    if (uniqueResults.length >= 80) break;
  }
  if (uniqueResults.length > 0) return res.status(200).json({ source: 'multiple-catalogs', results: uniqueResults });

  const imdbSearchUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(query)}`;
  return res.status(200).json({
    source: 'movies',
    results: [{
      title: `Buscar "${query}" en IMDb`,
      description: 'No hubo resultados automáticos. Puedes buscar directamente en IMDb.',
      image: '',
      url: imdbSearchUrl,
      type: 'link',
      year: '',
    }],
  });
};

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
