// Vercel Serverless Function - Search TMDB with OMDb fallback
// Endpoint: GET /api/search-movies?q=<query>
// TMDB_API_KEY is recommended. OMDB_API_KEY remains a fallback.

module.exports = async function handler(req, res) {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  const tmdbKey = process.env.TMDB_API_KEY;
  const omdbKey = process.env.OMDB_API_KEY;
  const tmdbGenres = {
    28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen',
    99: 'Documental', 18: 'Drama', 10751: 'Familia', 14: 'Fantasía', 36: 'Historia',
    27: 'Terror', 10402: 'Música', 9648: 'Misterio', 10749: 'Romance',
    878: 'Ciencia ficción', 10770: 'Película de TV', 53: 'Suspenso', 10752: 'Bélica', 37: 'Western',
  };

  if (tmdbKey) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(tmdbKey)}&language=es-ES&query=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error(`TMDB API returned ${response.status}`);

      const data = await response.json();
      const results = (data.results || [])
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .slice(0, 20)
        .map(item => ({
          title: item.title || item.name || 'Sin título',
          description: item.overview || '',
          genre: item.genre_ids?.map(id => tmdbGenres[id]).filter(Boolean).join(', ') || '',
          chapters: null,
          pages: null,
          image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
          url: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
          type: item.media_type === 'tv' ? 'Series' : 'Movie',
          year: (item.release_date || item.first_air_date || '').slice(0, 4),
        }));

      return res.status(200).json({ source: 'tmdb', results });
    } catch (err) {
      console.error('TMDB search error:', err);
    }
  }

  if (omdbKey) try {
    const response = await fetch(
      `https://www.omdbapi.com/?apikey=${encodeURIComponent(omdbKey)}&s=${encodeURIComponent(query)}&type=&r=json`
    );

    if (!response.ok) {
      throw new Error(`OMDB API returned ${response.status}`);
    }

    const data = await response.json();

    const results = data.Response === 'False' ? [] : (data.Search || []).map(item => ({
      title: item.Title || 'Sin título',
      description: `${item.Type || ''} · ${item.Year || ''}`.trim(),
      image: item.Poster && item.Poster !== 'N/A' ? item.Poster : '',
      url: `https://www.imdb.com/title/${item.imdbID}`,
      type: item.Type === 'series' ? 'Series' : 'Movie',
      year: item.Year || '',
    }));

      if (results.length > 0) return res.status(200).json({ source: 'omdb', results });
  } catch (err) {
    console.error('OMDB search error:', err);
  }

  try {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`TVmaze API returned ${response.status}`);

    const data = await response.json();
    const results = (data || []).slice(0, 20).map(item => ({
      title: item.show?.name || 'Sin título',
      description: item.show?.summary?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
      genre: item.show?.genres?.join(', ') || '',
      chapters: null,
      pages: null,
      image: item.show?.image?.original || item.show?.image?.medium || '',
      url: item.show?.url || '',
      type: 'Series',
      year: item.show?.premiered?.slice(0, 4) || '',
    }));

    if (results.length > 0) return res.status(200).json({ source: 'tvmaze', results });
  } catch (tvmazeError) {
    console.error('TVmaze search error:', tvmazeError);
  }

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
