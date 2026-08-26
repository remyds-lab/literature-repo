// Vercel Serverless Function - Search Open Library with Google Books fallback
// Endpoint: GET /api/search-books?q=<query>

module.exports = async function handler(req, res) {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=20&fields=title,author_name,first_publish_year,cover_i,key,subject`
    );
    if (!response.ok) throw new Error(`Open Library API returned ${response.status}`);

    const data = await response.json();
    const results = (data.docs || []).map(book => ({
      title: book.title || 'Sin título',
      description: book.author_name?.join(', ') || 'Libro disponible en Open Library',
      genre: book.subject?.slice(0, 5).join(', ') || '',
      chapters: null,
      image: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : '',
      url: book.key ? `https://openlibrary.org${book.key}` : `https://openlibrary.org/search?title=${encodeURIComponent(query)}`,
      type: 'Book',
      year: book.first_publish_year || '',
    }));

    if (results.length > 0) return res.status(200).json({ source: 'open-library', results });
  } catch (openLibraryError) {
    console.error('Open Library search error:', openLibraryError);
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=20`
    );
    if (!response.ok) throw new Error(`Google Books API returned ${response.status}`);

    const data = await response.json();
    const results = (data.items || []).map(item => {
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
    });

    if (results.length > 0) return res.status(200).json({ source: 'google-books', results });
  } catch (googleError) {
    console.error('Google Books search error:', googleError);
  }

  try {
    // HathiTrust Catalog API – search by title
    const url = `https://catalog.hathitrust.org/api/volumes/brief/title/${encodeURIComponent(query)}.json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HathiTrust API returned ${response.status}`);
    }

    const data = await response.json();

    // HathiTrust returns {items: [{...}]} with item keys being htids
    const itemsObj = data.items || {};
    const results = [];

    const entries = Object.values(itemsObj);
    // Limit to first 20 unique titles
    const seenTitles = new Set();

    for (const item of entries) {
      if (results.length >= 20) break;

      const records = item.records || {};
      for (const recId in records) {
        const rec = records[recId];
        const title = (rec.titles || ['Sin título'])[0];

        if (seenTitles.has(title.toLowerCase())) continue;
        seenTitles.add(title.toLowerCase());

        const authors = rec.publishDates
          ? rec.publishDates.join(', ')
          : '';

        const recordUrl = rec.recordURL || `https://catalog.hathitrust.org/Record/${recId}`;

        results.push({
          title: title,
          description: `${(rec.isbns || []).join(', ')} ${authors}`.trim() || 'Libro disponible en HathiTrust',
          image: '',
          url: recordUrl,
          type: 'Book',
          year: authors,
        });

        if (results.length >= 20) break;
      }
    }

    // If no results from API, provide a direct search link
    if (results.length === 0) {
      results.push({
        title: `Buscar "${query}" en HathiTrust`,
        description: 'No se encontraron resultados directos. Haz clic para buscar en la web de HathiTrust.',
        image: '',
        url: `https://catalog.hathitrust.org/Search/Home?lookfor=${encodeURIComponent(query)}&type=title`,
        type: 'link',
        year: '',
      });
    }

    res.status(200).json({ source: 'hathitrust', results });
  } catch (err) {
    console.error('HathiTrust search error:', err);
    // Fallback: return a direct search link
    res.status(200).json({
      source: 'hathitrust',
      results: [{
        title: `Buscar "${query}" en HathiTrust`,
        description: 'Hubo un error con la API. Haz clic para buscar directamente.',
        image: '',
        url: `https://catalog.hathitrust.org/Search/Home?lookfor=${encodeURIComponent(query)}&type=title`,
        type: 'link',
        year: '',
      }],
    });
  }
};
