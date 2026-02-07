const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = 'https://nhomhjvscougplrlxczm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ob21oanZzY291Z3Bscmx4Y3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5Njk3MzAsImV4cCI6MjA4NTU0NTczMH0.84mcONf4cqmypXKqN7EoDYsy6K9IFUmEbwtQ3iYQQ6Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CORS Configuration - Mejorado para TV LG
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // 24 horas
}));

// Headers adicionales para compatibilidad con TV
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// Logging middleware para debug
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ============================================
// HEALTH & METADATA
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});

// Get streaming providers
app.get('/api/streaming-providers', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('streaming_providers')
            .select('id, name, logo_path, display_priority')
            .order('display_priority', { ascending: true });
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/streaming-providers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get genres
app.get('/api/genres', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('genres')
            .select('id, name')
            .order('name', { ascending: true });
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/genres:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// MOVIES - DISCOVERY & LISTING
// ============================================

// Get recommendations (top 5 más populares)
app.get('/api/movies/recommendations', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, runtime')
            .order('popularity', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/movies/recommendations:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get popular movies (con paginación)
app.get('/api/movies/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, runtime, release_date')
            .order('popularity', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data, pagination: { limit, offset, count: data.length } });
    } catch (error) {
        console.error('Error in /api/movies/popular:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get recent movies (ordenadas por fecha de estreno)
app.get('/api/movies/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, runtime, release_date')
            .not('release_date', 'is', null)
            .order('release_date', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data, pagination: { limit, offset, count: data.length } });
    } catch (error) {
        console.error('Error in /api/movies/recent:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get top rated movies
app.get('/api/movies/top-rated', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, runtime, release_date')
            .not('vote_average', 'is', null)
            .gte('vote_average', 7.0) // Solo películas con rating >= 7
            .order('vote_average', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data, pagination: { limit, offset, count: data.length } });
    } catch (error) {
        console.error('Error in /api/movies/top-rated:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get movies by streaming platform(s)
app.get('/api/movies/by-platform', async (req, res) => {
    try {
        const { providers, limit = 20, offset = 0 } = req.query;
        
        if (!providers) {
            return res.status(400).json({ success: false, error: 'providers query param is required (comma-separated IDs)' });
        }

        const providerIds = providers.split(',').map(id => parseInt(id.trim()));

        // Obtener movie_ids de las plataformas seleccionadas (solo activas, no removidas)
        const { data: movieStreaming, error: msError } = await supabase
            .from('movie_streaming')
            .select('movie_id')
            .in('provider_id', providerIds)
            .is('removed_at', null);

        if (msError) throw msError;

        const movieIds = [...new Set(movieStreaming.map(m => m.movie_id))]; // Eliminar duplicados
        
        if (movieIds.length === 0) {
            return res.json({ success: true, data: [], pagination: { limit: parseInt(limit), offset: parseInt(offset), count: 0 } });
        }

        // Obtener detalles de las películas
        const { data: movies, error: moviesError } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, runtime, release_date')
            .in('id', movieIds)
            .order('popularity', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (moviesError) throw moviesError;

        res.json({ success: true, data: movies, pagination: { limit: parseInt(limit), offset: parseInt(offset), count: movies.length } });
    } catch (error) {
        console.error('Error in /api/movies/by-platform:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get movies by genre
app.get('/api/movies/by-genre/:genreId', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        // Obtener movie_ids del género
        const { data: movieGenres, error: mgError } = await supabase
            .from('movie_genres')
            .select('movie_id')
            .eq('genre_id', req.params.genreId);
        
        if (mgError) throw mgError;
        
        const movieIds = movieGenres.map(mg => mg.movie_id);
        
        if (movieIds.length === 0) {
            return res.json({ success: true, data: [], pagination: { limit, offset, count: 0 } });
        }
        
        // Obtener detalles de las películas
        const { data: movies, error: moviesError } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, runtime, release_date')
            .in('id', movieIds)
            .order('popularity', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (moviesError) throw moviesError;
        
        res.json({ success: true, data: movies, pagination: { limit, offset, count: movies.length } });
    } catch (error) {
        console.error('Error in /api/movies/by-genre:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Search movies
app.get('/api/movies/search', async (req, res) => {
    try {
        const { q, limit = 20, offset = 0 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
        }
        
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, original_title, backdrop_path, poster_path, popularity, vote_average, overview, runtime, release_date')
            .or(`title.ilike.%${q}%,original_title.ilike.%${q}%`)
            .order('popularity', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        
        if (error) throw error;
        res.json({ success: true, data, query: q, pagination: { limit: parseInt(limit), offset: parseInt(offset), count: data.length } });
    } catch (error) {
        console.error('Error in /api/movies/search:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// MOVIES - DETAIL
// ============================================

// Get movie detail by ID

// Get trending movies (últimos X meses con mayor popularidad)
app.get('/api/movies/trending', async (req, res) => {
    try {
        const months = parseInt(req.query.months) || 6;
        const limit = parseInt(req.query.limit) || 20;
        const providers = req.query.providers;
        
        const dateThreshold = new Date();
        dateThreshold.setMonth(dateThreshold.getMonth() - months);
        const dateString = dateThreshold.toISOString().split('T')[0];
        
        let movieIds = null;
        
        // Si hay filtro de plataformas, obtener movie_ids primero
        if (providers && providers !== 'all') {
            const providerIds = providers.split(',').map(id => parseInt(id.trim()));
            const { data: movieStreaming, error: msError } = await supabase
                .from('movie_streaming')
                .select('movie_id')
                .in('provider_id', providerIds)
                .is('removed_at', null);
            
            if (msError) throw msError;
            movieIds = [...new Set(movieStreaming.map(m => m.movie_id))];
            
            if (movieIds.length === 0) {
                return res.json({ success: true, data: [] });
            }
        }
        
        let query = supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, runtime, release_date')
            .gte('release_date', dateString)
            .order('popularity', { ascending: false })
            .limit(limit);
        
        if (movieIds) {
            query = query.in('id', movieIds);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/movies/trending:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get top rated movies by friends
app.get('/api/movies/top-rated-by-friends', async (req, res) => {
    try {
        const userId = req.query.userId;
        const limit = parseInt(req.query.limit) || 20;
        const providers = req.query.providers;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        
        // Obtener valoraciones de otros usuarios (amigos)
        const { data: ratings, error: ratingsError } = await supabase
            .from('user_movie_ratings')
            .select(`
                movie_id,
                rating,
                user_id,
                users (
                    id,
                    name,
                    avatar_url
                )
            `)
            .neq('user_id', userId)
            .not('rating', 'is', null)
            .order('rating', { ascending: false });
        
        if (ratingsError) throw ratingsError;
        
        if (ratings.length === 0) {
            return res.json({ success: true, data: [] });
        }
        
        // Agrupar por película y calcular rating promedio
        const movieRatings = {};
        ratings.forEach(r => {
            if (!movieRatings[r.movie_id]) {
                movieRatings[r.movie_id] = {
                    movie_id: r.movie_id,
                    ratings: [],
                    top_friend: r.users
                };
            }
            movieRatings[r.movie_id].ratings.push(r.rating);
        });
        
        // Calcular promedios y ordenar
        const sortedMovies = Object.values(movieRatings)
            .map(m => ({
                movie_id: m.movie_id,
                avg_rating: m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length,
                friend_name: m.top_friend?.name
            }))
            .sort((a, b) => b.avg_rating - a.avg_rating)
            .slice(0, limit * 2);
        
        const movieIds = sortedMovies.map(m => m.movie_id);
        
        // Obtener detalles de películas
        let moviesQuery = supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, runtime, release_date')
            .in('id', movieIds);
        
        // Filtrar por plataformas si es necesario
        if (providers && providers !== 'all') {
            const providerIds = providers.split(',').map(id => parseInt(id.trim()));
            const { data: movieStreaming, error: msError } = await supabase
                .from('movie_streaming')
                .select('movie_id')
                .in('provider_id', providerIds)
                .in('movie_id', movieIds)
                .is('removed_at', null);
            
            if (msError) throw msError;
            const filteredIds = [...new Set(movieStreaming.map(m => m.movie_id))];
            
            if (filteredIds.length === 0) {
                return res.json({ success: true, data: [] });
            }
            
            moviesQuery = moviesQuery.in('id', filteredIds);
        }
        
        const { data: movies, error: moviesError } = await moviesQuery;
        
        if (moviesError) throw moviesError;
        
        // Combinar con ratings de amigos
        const moviesWithRatings = movies.map(movie => {
            const ratingInfo = sortedMovies.find(m => m.movie_id === movie.id);
            return {
                ...movie,
                friend_rating: ratingInfo?.avg_rating,
                friend_name: ratingInfo?.friend_name
            };
        }).sort((a, b) => b.friend_rating - a.friend_rating).slice(0, limit);
        
        res.json({ success: true, data: moviesWithRatings });
    } catch (error) {
        console.error('Error in /api/movies/top-rated-by-friends:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/movies/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('movies')
            .select('*')
            .eq('id', req.params.id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Película no encontrada' 
                });
            }
            throw error;
        }
        
        // Obtener géneros
        const { data: genreData, error: genreError } = await supabase
            .from('movie_genres')
            .select('genre_id, genres(id, name)')
            .eq('movie_id', req.params.id);
        
        const genres = genreData 
            ? genreData.filter(g => g.genres).map(g => g.genres)
            : [];
        
        // Obtener streaming providers (solo activos)
        const { data: streamingData, error: streamingError } = await supabase
            .from('movie_streaming')
            .select('provider_id, type, streaming_providers(id, name, logo_path)')
            .eq('movie_id', req.params.id)
            .is('removed_at', null);
        
        const providers = {
            flatrate: streamingData 
                ? streamingData
                    .filter(item => item.type === 'flatrate' && item.streaming_providers !== null)
                    .map(item => item.streaming_providers)
                : []
        };
        
        const movieWithDetails = {
            ...data,
            genres,
            streaming_providers: providers
        };
        
        res.json({ success: true, data: movieWithDetails });
    } catch (error) {
        console.error('Error in /api/movies/:id:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// SERIES - DISCOVERY & LISTING
// ============================================

// Get popular series
app.get('/api/series/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const { data, error } = await supabase
            .from('series')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, first_air_date, number_of_seasons, status')
            .order('popularity', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data, pagination: { limit, offset, count: data.length } });
    } catch (error) {
        console.error('Error in /api/series/popular:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get recent series
app.get('/api/series/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const { data, error } = await supabase
            .from('series')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, first_air_date, number_of_seasons, status')
            .not('first_air_date', 'is', null)
            .order('first_air_date', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data, pagination: { limit, offset, count: data.length } });
    } catch (error) {
        console.error('Error in /api/series/recent:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get top rated series
app.get('/api/series/top-rated', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const { data, error } = await supabase
            .from('series')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, first_air_date, number_of_seasons, status')
            .not('vote_average', 'is', null)
            .gte('vote_average', 7.0)
            .order('vote_average', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data, pagination: { limit, offset, count: data.length } });
    } catch (error) {
        console.error('Error in /api/series/top-rated:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get currently airing series (Returning Series)
app.get('/api/series/on-air', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const { data, error } = await supabase
            .from('series')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, first_air_date, number_of_seasons, status')
            .eq('status', 'Returning Series')
            .order('popularity', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data, pagination: { limit, offset, count: data.length } });
    } catch (error) {
        console.error('Error in /api/series/on-air:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get series by streaming platform(s)
app.get('/api/series/by-platform', async (req, res) => {
    try {
        const { providers, limit = 20, offset = 0 } = req.query;
        
        if (!providers) {
            return res.status(400).json({ success: false, error: 'providers query param is required (comma-separated IDs)' });
        }

        const providerIds = providers.split(',').map(id => parseInt(id.trim()));

        const { data: seriesStreaming, error: ssError } = await supabase
            .from('series_streaming')
            .select('series_id')
            .in('provider_id', providerIds)
            .is('removed_at', null);

        if (ssError) throw ssError;

        const seriesIds = [...new Set(seriesStreaming.map(s => s.series_id))];
        
        if (seriesIds.length === 0) {
            return res.json({ success: true, data: [], pagination: { limit: parseInt(limit), offset: parseInt(offset), count: 0 } });
        }

        const { data: series, error: seriesError } = await supabase
            .from('series')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, first_air_date, number_of_seasons, status')
            .in('id', seriesIds)
            .order('popularity', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (seriesError) throw seriesError;

        res.json({ success: true, data: series, pagination: { limit: parseInt(limit), offset: parseInt(offset), count: series.length } });
    } catch (error) {
        console.error('Error in /api/series/by-platform:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get series by genre
app.get('/api/series/by-genre/:genreId', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const { data: seriesGenres, error: sgError } = await supabase
            .from('series_genres')
            .select('series_id')
            .eq('genre_id', req.params.genreId);
        
        if (sgError) throw sgError;
        
        const seriesIds = seriesGenres.map(sg => sg.series_id);
        
        if (seriesIds.length === 0) {
            return res.json({ success: true, data: [], pagination: { limit, offset, count: 0 } });
        }
        
        const { data: series, error: seriesError } = await supabase
            .from('series')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, first_air_date, number_of_seasons, status')
            .in('id', seriesIds)
            .order('popularity', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (seriesError) throw seriesError;
        
        res.json({ success: true, data: series, pagination: { limit, offset, count: series.length } });
    } catch (error) {
        console.error('Error in /api/series/by-genre:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Search series
app.get('/api/series/search', async (req, res) => {
    try {
        const { q, limit = 20, offset = 0 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
        }
        
        const { data, error } = await supabase
            .from('series')
            .select('id, title, original_title, backdrop_path, poster_path, popularity, vote_average, overview, first_air_date, number_of_seasons, status')
            .or(`title.ilike.%${q}%,original_title.ilike.%${q}%`)
            .order('popularity', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
        
        if (error) throw error;
        res.json({ success: true, data, query: q, pagination: { limit: parseInt(limit), offset: parseInt(offset), count: data.length } });
    } catch (error) {
        console.error('Error in /api/series/search:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get trending series (últimos X meses con mayor popularidad)
app.get('/api/series/trending', async (req, res) => {
    try {
        const months = parseInt(req.query.months) || 3;
        const limit = parseInt(req.query.limit) || 20;
        const providers = req.query.providers;
        
        const dateThreshold = new Date();
        dateThreshold.setMonth(dateThreshold.getMonth() - months);
        const dateString = dateThreshold.toISOString().split('T')[0];
        
        let seriesIds = null;
        
        // Si hay filtro de plataformas, obtener series_ids primero
        if (providers && providers !== 'all') {
            const providerIds = providers.split(',').map(id => parseInt(id.trim()));
            const { data: seriesStreaming, error: ssError } = await supabase
                .from('series_streaming')
                .select('series_id')
                .in('provider_id', providerIds)
                .is('removed_at', null);
            
            if (ssError) throw ssError;
            seriesIds = [...new Set(seriesStreaming.map(s => s.series_id))];
            
            if (seriesIds.length === 0) {
                return res.json({ success: true, data: [] });
            }
        }
        
        let query = supabase
            .from('series')
            .select('id, title, backdrop_path, poster_path, popularity, vote_average, overview, last_air_date')
            .gte('last_air_date', dateString)
            .order('popularity', { ascending: false })
            .limit(limit);
        
        if (seriesIds) {
            query = query.in('id', seriesIds);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/series/trending:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get top rated series by friends
app.get('/api/series/top-rated-by-friends', async (req, res) => {
    try {
        const userId = req.query.userId;
        const limit = parseInt(req.query.limit) || 20;
        const providers = req.query.providers;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        
        // Obtener valoraciones de otros usuarios (amigos)
        const { data: ratings, error: ratingsError } = await supabase
            .from('user_series_ratings')
            .select(`
                series_id,
                rating,
                user_id,
                users (
                    id,
                    name,
                    avatar_url
                )
            `)
            .neq('user_id', userId)
            .not('rating', 'is', null)
            .order('rating', { ascending: false });
        
        if (ratingsError) throw ratingsError;
        
        if (ratings.length === 0) {
            return res.json({ success: true, data: [] });
        }
        
        // Agrupar por serie y calcular rating promedio
        const seriesRatings = {};
        ratings.forEach(r => {
            if (!seriesRatings[r.series_id]) {
                seriesRatings[r.series_id] = {
                    series_id: r.series_id,
                    ratings: [],
                    top_friend: r.users
                };
            }
            seriesRatings[r.series_id].ratings.push(r.rating);
        });
        
        // Calcular promedios y ordenar
        const sortedSeries = Object.values(seriesRatings)
            .map(s => ({
                series_id: s.series_id,
                avg_rating: s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length,
                friend_name: s.top_friend?.name
            }))
            .sort((a, b) => b.avg_rating - a.avg_rating)
            .slice(0, limit * 2);
        
        const seriesIds = sortedSeries.map(s => s.series_id);
        
        // Obtener detalles de series
        let seriesQuery = supabase
            .from('series')
            .select('id, title, name, backdrop_path, poster_path, popularity, vote_average, overview, last_air_date')
            .in('id', seriesIds);
        
        // Filtrar por plataformas si es necesario
        if (providers && providers !== 'all') {
            const providerIds = providers.split(',').map(id => parseInt(id.trim()));
            const { data: seriesStreaming, error: ssError } = await supabase
                .from('series_streaming')
                .select('series_id')
                .in('provider_id', providerIds)
                .in('series_id', seriesIds)
                .is('removed_at', null);
            
            if (ssError) throw ssError;
            const filteredIds = [...new Set(seriesStreaming.map(s => s.series_id))];
            
            if (filteredIds.length === 0) {
                return res.json({ success: true, data: [] });
            }
            
            seriesQuery = seriesQuery.in('id', filteredIds);
        }
        
        const { data: series, error: seriesError } = await seriesQuery;
        
        if (seriesError) throw seriesError;
        
        // Combinar con ratings de amigos
        const seriesWithRatings = series.map(s => {
            const ratingInfo = sortedSeries.find(sr => sr.series_id === s.id);
            return {
                ...s,
                friend_rating: ratingInfo?.avg_rating,
                friend_name: ratingInfo?.friend_name
            };
        }).sort((a, b) => b.friend_rating - a.friend_rating).slice(0, limit);
        
        res.json({ success: true, data: seriesWithRatings });
    } catch (error) {
        console.error('Error in /api/series/top-rated-by-friends:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// SERIES - DETAIL
// ============================================

// Get series detail by ID
app.get('/api/series/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('series')
            .select('*')
            .eq('id', req.params.id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Serie no encontrada' 
                });
            }
            throw error;
        }
        
        // Obtener géneros
        const { data: genreData, error: genreError } = await supabase
            .from('series_genres')
            .select('genre_id, genres(id, name)')
            .eq('series_id', req.params.id);
        
        const genres = genreData 
            ? genreData.filter(g => g.genres).map(g => g.genres)
            : [];
        
        // Obtener streaming providers (solo activos)
        const { data: streamingData, error: streamingError } = await supabase
            .from('series_streaming')
            .select('provider_id, type, streaming_providers(id, name, logo_path)')
            .eq('series_id', req.params.id)
            .is('removed_at', null);
        
        const providers = {
            flatrate: streamingData 
                ? streamingData
                    .filter(item => item.type === 'flatrate' && item.streaming_providers !== null)
                    .map(item => item.streaming_providers)
                : []
        };
        
        const seriesWithDetails = {
            ...data,
            genres,
            streaming_providers: providers
        };
        
        res.json({ success: true, data: seriesWithDetails });
    } catch (error) {
        console.error('Error in /api/series/:id:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// FAVORITES
// ============================================

// Get user favorites (movies and series)
app.get('/api/favorites', async (req, res) => {
    try {
        const { userId, contentType } = req.query;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        
        let query = supabase
            .from('favorites')
            .select('id, content_type, content_id, added_at')
            .eq('user_id', userId)
            .order('added_at', { ascending: false });
        
        if (contentType) {
            query = query.eq('content_type', contentType);
        }
        
        const { data: favorites, error } = await query;
        
        if (error) throw error;
        
        // Enriquecer con detalles de películas/series
        const enrichedFavorites = await Promise.all(favorites.map(async (fav) => {
            if (fav.content_type === 'movie') {
                const { data: movie } = await supabase
                    .from('movies')
                    .select('id, title, poster_path, backdrop_path, vote_average, release_date')
                    .eq('id', fav.content_id)
                    .single();
                
                return { ...fav, content: movie };
            } else if (fav.content_type === 'series') {
                const { data: series } = await supabase
                    .from('series')
                    .select('id, title, poster_path, backdrop_path, vote_average, first_air_date')
                    .eq('id', fav.content_id)
                    .single();
                
                return { ...fav, content: series };
            }
            return fav;
        }));
        
        res.json({ success: true, data: enrichedFavorites.filter(f => f.content !== null) });
    } catch (error) {
        console.error('Error in /api/favorites:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add to favorites
app.post('/api/favorites', async (req, res) => {
    try {
        const { userId, contentType, contentId } = req.body;
        
        if (!userId || !contentType || !contentId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId, contentType, and contentId are required' 
            });
        }
        
        if (!['movie', 'series'].includes(contentType)) {
            return res.status(400).json({ 
                success: false, 
                error: 'contentType must be "movie" or "series"' 
            });
        }
        
        const { data, error } = await supabase
            .from('favorites')
            .insert({
                user_id: userId,
                content_type: contentType,
                content_id: contentId
            })
            .select()
            .single();
        
        if (error) {
            // Si ya existe, devolver el existente
            if (error.code === '23505') { // Unique constraint violation
                const { data: existing } = await supabase
                    .from('favorites')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('content_type', contentType)
                    .eq('content_id', contentId)
                    .single();
                
                return res.json({ success: true, data: existing, message: 'Already in favorites' });
            }
            throw error;
        }
        
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in POST /api/favorites:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove from favorites
app.delete('/api/favorites', async (req, res) => {
    try {
        const { userId, contentType, contentId } = req.body;
        
        if (!userId || !contentType || !contentId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId, contentType, and contentId are required' 
            });
        }
        
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', userId)
            .eq('content_type', contentType)
            .eq('content_id', contentId);
        
        if (error) throw error;
        
        res.json({ success: true, message: 'Removed from favorites' });
    } catch (error) {
        console.error('Error in DELETE /api/favorites:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check if content is favorited
app.get('/api/favorites/check', async (req, res) => {
    try {
        const { userId, contentType, contentId } = req.query;
        
        if (!userId || !contentType || !contentId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId, contentType, and contentId are required' 
            });
        }
        
        const { data, error } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('content_type', contentType)
            .eq('content_id', contentId)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        res.json({ success: true, isFavorite: data !== null });
    } catch (error) {
        console.error('Error in /api/favorites/check:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// USER RATINGS (mantener compatibilidad)
// ============================================

// Get user rating for a movie
app.get('/api/movies/:id/user-rating', async (req, res) => {
    try {
        const userId = req.query.userId;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId is required' 
            });
        }

        const { data, error } = await supabase
            .from('user_movie_ratings')
            .select('*')
            .eq('movie_id', req.params.id)
            .eq('user_id', userId)
            .single();
        
        if (error && error.code === 'PGRST116') {
            return res.json({ success: true, data: null });
        }
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/movies/:id/user-rating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get friends ratings for a movie
app.get('/api/movies/:id/friends-ratings', async (req, res) => {
    try {
        const userId = req.query.userId;
        
        const { data, error } = await supabase
            .from('user_movie_ratings')
            .select(`
                rating,
                watched,
                user_id,
                users (
                    id,
                    name,
                    avatar_url
                )
            `)
            .eq('movie_id', req.params.id)
            .neq('user_id', userId || 'no-user')
            .not('rating', 'is', null);
        
        if (error) throw error;
        
        const friendsRatings = data
            .filter(item => item.users !== null)
            .map(item => ({
                rating: item.rating,
                watched: item.watched,
                name: item.users.name,
                avatar_url: item.users.avatar_url
            }));
        
        res.json({ success: true, data: friendsRatings });
    } catch (error) {
        console.error('Error in /api/movies/:id/friends-ratings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rate a movie
app.post('/api/movies/:id/rate', async (req, res) => {
    try {
        const { userId, rating } = req.body;
        
        if (!userId || !rating) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId and rating are required' 
            });
        }
        
        if (rating < 1 || rating > 10) {
            return res.status(400).json({ 
                success: false, 
                error: 'Rating must be between 1 and 10' 
            });
        }
        
        const { data, error } = await supabase
            .from('user_movie_ratings')
            .upsert({
                user_id: userId,
                movie_id: parseInt(req.params.id),
                rating: rating,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,movie_id'
            })
            .select()
            .single();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/movies/:id/rate:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark movie as watched/unwatched
app.post('/api/movies/:id/watched', async (req, res) => {
    try {
        const { userId, watched } = req.body;
        
        if (!userId || watched === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId and watched are required' 
            });
        }
        
        const updateData = {
            user_id: userId,
            movie_id: parseInt(req.params.id),
            watched: watched,
            updated_at: new Date().toISOString()
        };
        
        if (watched) {
            updateData.watched_date = new Date().toISOString();
        } else {
            updateData.watched_date = null;
        }
        
        const { data, error } = await supabase
            .from('user_movie_ratings')
            .upsert(updateData, {
                onConflict: 'user_id,movie_id'
            })
            .select()
            .single();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/movies/:id/watched:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// NEW ENDPOINTS FOR HOME PAGE
// ============================================

// Get recently watched by friends (mixed movies and series)
app.get('/api/recently-watched-by-friends', async (req, res) => {
    try {
        const userId = req.query.userId;
        const limit = parseInt(req.query.limit) || 20;
        
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        
        // Obtener películas vistas por amigos
        const { data: movieRatings, error: movieError } = await supabase
            .from('user_movie_ratings')
            .select(`
                movie_id,
                watched_date,
                user_id,
                users (
                    id,
                    name,
                    avatar_url
                )
            `)
            .neq('user_id', userId)
            .eq('watched', true)
            .not('watched_date', 'is', null)
            .order('watched_date', { ascending: false })
            .limit(limit);
        
        // Obtener series vistas por amigos
        const { data: seriesRatings, error: seriesError } = await supabase
            .from('user_series_ratings')
            .select(`
                series_id,
                watched_date,
                user_id,
                users (
                    id,
                    name,
                    avatar_url
                )
            `)
            .neq('user_id', userId)
            .eq('watched', true)
            .not('watched_date', 'is', null)
            .order('watched_date', { ascending: false })
            .limit(limit);
        
        if (movieError) throw movieError;
        if (seriesError) throw seriesError;
        
        // Combinar y ordenar por fecha
        const allWatched = [
            ...(movieRatings || []).map(m => ({ ...m, media_type: 'movie', id: m.movie_id })),
            ...(seriesRatings || []).map(s => ({ ...s, media_type: 'series', id: s.series_id }))
        ].sort((a, b) => new Date(b.watched_date) - new Date(a.watched_date)).slice(0, limit);
        
        if (allWatched.length === 0) {
            return res.json({ success: true, data: [] });
        }
        
        // Separar IDs de películas y series
        const movieIds = allWatched.filter(w => w.media_type === 'movie').map(w => w.id);
        const seriesIds = allWatched.filter(w => w.media_type === 'series').map(w => w.id);
        
        // Obtener detalles de películas
        let movies = [];
        if (movieIds.length > 0) {
            const { data, error } = await supabase
                .from('movies')
                .select('id, title, backdrop_path, poster_path, vote_average')
                .in('id', movieIds);
            
            if (error) throw error;
            movies = data || [];
        }
        
        // Obtener detalles de series
        let series = [];
        if (seriesIds.length > 0) {
            const { data, error } = await supabase
                .from('series')
                .select('id, title, name, backdrop_path, poster_path, vote_average')
                .in('id', seriesIds);
            
            if (error) throw error;
            series = data || [];
        }
        
        // Combinar todo
        const results = allWatched.map(w => {
            const detail = w.media_type === 'movie' 
                ? movies.find(m => m.id === w.id)
                : series.find(s => s.id === w.id);
            
            return {
                ...detail,
                media_type: w.media_type,
                watched_date: w.watched_date,
                watched_by_name: w.users?.name
            };
        }).filter(r => r.id); // Filtrar los que no se encontraron detalles
        
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error in /api/recently-watched-by-friends:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// MIXED CONTENT (Movies + Series)
// ============================================

// Search across movies and series
app.get('/api/search', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
        }
        
        // Buscar películas
        const { data: movies, error: moviesError } = await supabase
            .from('movies')
            .select('id, title, poster_path, vote_average, release_date')
            .or(`title.ilike.%${q}%,original_title.ilike.%${q}%`)
            .order('popularity', { ascending: false })
            .limit(parseInt(limit) / 2);
        
        // Buscar series
        const { data: series, error: seriesError } = await supabase
            .from('series')
            .select('id, title, poster_path, vote_average, first_air_date')
            .or(`title.ilike.%${q}%,original_title.ilike.%${q}%`)
            .order('popularity', { ascending: false })
            .limit(parseInt(limit) / 2);
        
        if (moviesError) throw moviesError;
        if (seriesError) throw seriesError;
        
        const results = {
            movies: movies || [],
            series: series || [],
            total: (movies?.length || 0) + (series?.length || 0)
        };
        
        res.json({ success: true, data: results, query: q });
    } catch (error) {
        console.error('Error in /api/search:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: err.message
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log('\n📚 Available endpoints:');
    console.log('  Movies: /api/movies/popular, /api/movies/recent, /api/movies/top-rated');
    console.log('  Series: /api/series/popular, /api/series/recent, /api/series/on-air');
    console.log('  Search: /api/search, /api/movies/search, /api/series/search');
    console.log('  Favorites: GET/POST/DELETE /api/favorites');
    console.log('  Platform: /api/movies/by-platform, /api/series/by-platform');
});
