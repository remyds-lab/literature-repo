// Vercel Serverless Function - Search multiple book catalogs
// Endpoint: GET /api/search-books?q=<query>

module.exports = async function handler(req, res) {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  const encodedQuery = encodeURIComponent(query);
  const requests = [
    fetch(`https://openlibrary.org/search.json?title=${encodedQuery}&limit=40&fields=title,author_name,first_publish_year,cover_i,key,subject`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Open Library API returned ${response.status}`))),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodedQuery}&maxResults=40`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`Google Books API returned ${response.status}`))),
    fetch(`https://catalog.hathitrust.org/api/volumes/brief/title/${encodedQuery}.json`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HathiTrust API returned ${response.status}`))),
  ];

  const [openLibrary, googleBooks, hathiTrust] = await Promise.allSettled(requests);
  const results = [];

  if (openLibrary.status === 'fulfilled') {
    results.push(...(openLibrary.value.docs || []).map(book => ({
      title: book.title || 'Sin título',
      description: book.author_name?.join(', ') || 'Libro disponible en Open Library',
      genre: book.subject?.slice(0, 5).join(', ') || '',
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
        genre: info.categories?.join(', ') || '',
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
          description: `${(record.isbns || []).join(', ')} ${(record.publishDates || []).join(', ')}`.trim() || 'Libro disponible en HathiTrust',
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

  const uniqueResults = [];
  const seenTitles = new Set();
  for (const result of results) {
    const key = result.title.trim().toLowerCase();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      uniqueResults.push(result);
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

  return res.status(200).json({ source: 'multiple-catalogs', results: uniqueResults });
};
