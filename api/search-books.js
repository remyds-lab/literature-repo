// Vercel Serverless Function - Search multiple book catalogs
// Endpoint: GET /api/search-books?q=<query>

module.exports = async function handler(req, res) {
  const query = String(req.query?.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  const encodedQuery = encodeURIComponent(query);
  const mode = req.query?.mode === 'author' ? 'author' : 'title';
  const cacheKey = `${mode}:${query.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.status(200).json(cached.data);
  const openLibraryQuery = mode === 'author' ? `author:${encodedQuery}` : `title:${encodedQuery}`;
  const googleQuery = mode === 'author' ? `inauthor:${encodedQuery}` : `intitle:${encodedQuery}`;
  const hathiPath = mode === 'author' ? 'author' : 'title';
  const gutendexQuery = mode === 'author' ? `author:${encodedQuery}` : encodedQuery;
  const requests = [
    fetchJson(`https://openlibrary.org/search.json?q=${openLibraryQuery}&limit=40&fields=title,author_name,first_publish_year,cover_i,key,subject`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Open Library API returned ${response.status}`))),
    fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=40`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Google Books API returned ${response.status}`))),
    fetchJson(`https://catalog.hathitrust.org/api/volumes/brief/${hathiPath}/${encodedQuery}.json`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HathiTrust API returned ${response.status}`))),
    fetchJson(`https://archive.org/advancedsearch.php?q=${mode === 'author' ? `creator:%22${encodedQuery}%22` : `title:%22${encodedQuery}%22`}&fl[]=identifier,title,description,creator,year&rows=40&output=json`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Internet Archive API returned ${response.status}`))),
    fetchJson(`https://gutendex.com/books/?search=${gutendexQuery}&page=1`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Gutendex API returned ${response.status}`))),
    fetchJson(`https://librivox.org/api/feed/audiobooks?${mode === 'author' ? 'author' : 'title'}=${encodedQuery}&format=json&limit=40`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`LibriVox API returned ${response.status}`))),
  ];

  const [openLibrary, googleBooks, hathiTrust, internetArchive, gutendex, librivox] = await Promise.allSettled(requests);
  const results = [];

  if (openLibrary.status === 'fulfilled') {
    results.push(...(openLibrary.value.docs || []).map(book => ({
      title: book.title || 'Sin título',
      description: book.author_name?.join(', ') || 'Libro disponible en Open Library',
      genre: Array.isArray(book.subject) ? book.subject.slice(0, 5).join(', ') : '',
      chapters: null,
      image: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : '',
      url: book.key ? `https://openlibrary.org${book.key}` : `https://openlibrary.org/search?title=${encodedQuery}`,
      type: 'Book',
      year: book.first_publish_year || '',
    })));
  }

  if (googleBooks.status === 'fulfilled') {
    results.push(...(googleBooks.value.items || []).map(item => {
      const info = item.volumeInfo || {};
      return {
        title: info.title || 'Sin título',
        description: info.description ? info.description.replace(/<[^>]*>/g, '').slice(0, 200) : '',
        genre: Array.isArray(info.categories) ? info.categories.join(', ') : '',
        chapters: null,
        image: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '',
        url: info.infoLink || `https://books.google.com/books?id=${item.id}`,
        type: 'Book',
        year: info.publishedDate || '',
      };
    }));
  }

  if (hathiTrust.status === 'fulfilled') {
    for (const item of Object.values(hathiTrust.value.items || {})) {
      for (const [recordId, record] of Object.entries(item.records || {})) {
        const title = (record.titles || ['Sin título'])[0];
        results.push({
          title,
          description: `${Array.isArray(record.isbns) ? record.isbns.join(', ') : ''} ${Array.isArray(record.publishDates) ? record.publishDates.join(', ') : ''}`.trim() || 'Libro disponible en HathiTrust',
          genre: '',
          chapters: null,
          image: '',
          url: record.recordURL || `https://catalog.hathitrust.org/Record/${recordId}`,
          type: 'Book',
          year: (record.publishDates || []).join(', '),
        });
      }
    }
  }

  if (internetArchive.status === 'fulfilled') {
    results.push(...(internetArchive.value.response?.docs || []).map(book => ({
      title: book.title || 'Sin título',
      description: Array.isArray(book.description) ? book.description[0] : (typeof book.description === 'string' ? book.description : book.creator || 'Libro disponible en Internet Archive'),
      genre: '', chapters: null, image: '',
      url: `https://archive.org/details/${book.identifier}`, type: 'Book', year: book.year || '',
    })));
  }

  if (gutendex.status === 'fulfilled') {
    results.push(...(gutendex.value.results || []).map(book => ({
      title: book.title || 'Sin título',
      description: Array.isArray(book.authors) ? book.authors.map(author => author.name).join(', ') : 'Libro disponible en Project Gutenberg',
      genre: '', chapters: null,
      image: book.formats?.['image/jpeg'] || '',
      url: book.formats?.['text/html'] || `https://www.gutenberg.org/ebooks/${book.id}`,
      type: 'Book', year: book.copyright || '',
    })));
  }

  if (librivox.status === 'fulfilled') {
    results.push(...(librivox.value.books || []).map(book => ({
      title: book.title || 'Sin título',
      description: typeof book.author === 'string' ? book.author : 'Audiolibro disponible en LibriVox',
      genre: '', chapters: null, image: book.coverart || '',
      url: book.url_librivox || `https://librivox.org/search?title=${encodedQuery}`,
      type: 'Book', year: book.copyright_year || '',
    })));
  }

  const uniqueResults = [];
  const seenTitles = new Set();
  for (const result of results) {
    const title = typeof result.title === 'string' ? result.title.trim() : '';
    if (!title) continue;
    const key = title.toLowerCase();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      uniqueResults.push({ ...result, title });
    }
    if (uniqueResults.length >= 60) break;
  }

  if (uniqueResults.length === 0) {
    uniqueResults.push({
      title: `Buscar "${query}" en catálogos`,
      description: 'No se encontraron resultados directos. Puedes buscar el título en HathiTrust.',
      image: '',
      url: `https://catalog.hathitrust.org/Search/Home?lookfor=${encodedQuery}&type=title`,
      type: 'link',
      year: '',
    });
  }

  uniqueResults.push({
    title: `Buscar "${query}" en El Libro Total`,
    description: mode === 'author' ? 'Consulta autores y obras en El Libro Total.' : 'Consulta libros y audiolibros en El Libro Total.',
    genre: '', chapters: null, image: '',
    url: 'https://www.ellibrototal.com/ltotal/', type: 'external-source', year: '',
  });

  const responseData = { source: 'multiple-catalogs', results: uniqueResults };
  searchCache.set(cacheKey, { data: responseData, expiresAt: Date.now() + 5 * 60 * 1000 });
  return res.status(200).json(responseData);
};

const searchCache = new Map();

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
