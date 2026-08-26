// Vercel Serverless Function - Search comic catalogs
// Endpoint: GET /api/search-comics?q=<query>

module.exports = async function handler(req, res) {
  const query = String(req.query?.q || '').trim();
  if (!query) return res.status(400).json({ error: 'Missing query parameter "q"' });

  const encodedQuery = encodeURIComponent(query);
  const requests = [
    fetchWithTimeout(`https://openlibrary.org/search.json?q=${encodedQuery}&subject=comics&limit=40&fields=title,author_name,first_publish_year,cover_i,key,subject`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Open Library API returned ${response.status}`))),
    fetchWithTimeout(`https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}+subject:comics&maxResults=40`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Google Books API returned ${response.status}`))),
  ];
  const [openLibrary, googleBooks] = await Promise.allSettled(requests);
  const results = [];

  if (openLibrary.status === 'fulfilled') {
    results.push(...(openLibrary.value.docs || []).map(comic => ({
      title: comic.title || 'Sin título',
      description: comic.author_name?.join(', ') || 'Cómic disponible en Open Library',
      genre: Array.isArray(comic.subject) ? comic.subject.slice(0, 5).join(', ') : 'Cómic',
      chapters: null,
      image: comic.cover_i ? `https://covers.openlibrary.org/b/id/${comic.cover_i}-M.jpg` : '',
      url: comic.key ? `https://openlibrary.org${comic.key}` : `https://openlibrary.org/search?q=${encodedQuery}`,
      type: 'Comic', year: comic.first_publish_year || '',
    })));
  }

  if (googleBooks.status === 'fulfilled') {
    results.push(...(googleBooks.value.items || []).map(item => {
      const info = item.volumeInfo || {};
      return {
        title: info.title || 'Sin título',
        description: info.description?.replace(/<[^>]*>/g, '').slice(0, 200) || 'Cómic disponible en Google Books',
        genre: Array.isArray(info.categories) ? info.categories.join(', ') : 'Cómic',
        chapters: null,
        image: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '',
        url: info.infoLink || `https://books.google.com/books?id=${item.id}`,
        type: 'Comic', year: info.publishedDate || '',
      };
    }));
  }

  const uniqueResults = [];
  const seenTitles = new Set();
  for (const result of results) {
    const title = String(result.title || '').trim();
    const key = title.toLowerCase();
    if (title && !seenTitles.has(key)) {
      seenTitles.add(key);
      uniqueResults.push({ ...result, title });
    }
    if (uniqueResults.length >= 80) break;
  }

  uniqueResults.push({
    title: `Buscar "${query}" en Comic Book Plus`,
    description: 'Consulta cómics de dominio público y clásicos digitalizados.',
    genre: 'Cómic', chapters: null, image: '',
    url: `https://comicbookplus.com/?search=${encodedQuery}`,
    type: 'Comic', year: '',
  });

  return res.status(200).json({ source: 'comic-catalogs', results: uniqueResults });
};

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
