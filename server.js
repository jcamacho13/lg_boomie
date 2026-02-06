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
    
    // Responder a preflight requests
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});

// Get all streaming providers
app.get('/api/streaming-providers', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('streaming_providers')
            .select('*')
            .order('display_priority', { ascending: true });
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/streaming-providers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get recommendations
app.get('/api/movies/recommendations', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity')
            .order('popularity', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/movies/recommendations:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get popular movies
app.get('/api/movies/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 5;
        
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, poster_path, popularity')
            .order('popularity', { ascending: false })
            .range(offset, offset + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error in /api/movies/popular:', error);
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

// Get movies by genre
app.get('/api/genres/:id/movies', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('movie_genres')
            .select('movie_id, movies(id, title, backdrop_path, poster_path, popularity)')
            .eq('genre_id', req.params.id)
            .limit(20);
        
        if (error) throw error;
        
        const movies = data
            .map(item => item.movies)
            .filter(movie => movie !== null)
            .sort((a, b) => b.popularity - a.popularity);
        
        res.json({ success: true, data: movies });
    } catch (error) {
        console.error('Error in /api/genres/:id/movies:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get movies by streaming provider
app.get('/api/streaming-providers/:id/movies', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type || 'flatrate'; // flatrate, rent, buy
        
        const { data, error } = await supabase
            .from('movie_streaming')
            .select(`
                movie_id,
                type,
                movies (
                    id,
                    title,
                    backdrop_path,
                    poster_path,
                    popularity,
                    vote_average
                )
            `)
            .eq('provider_id', req.params.id)
            .eq('type', type)
            .limit(limit);
        
        if (error) throw error;
        
        const movies = data
            .map(item => item.movies)
            .filter(movie => movie !== null)
            .sort((a, b) => b.popularity - a.popularity);
        
        res.json({ success: true, data: movies });
    } catch (error) {
        console.error('Error in /api/streaming-providers/:id/movies:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get movie detail by ID (with streaming providers)
app.get('/api/movies/:id', async (req, res) => {
    try {
        // Get movie details
        const { data: movie, error: movieError } = await supabase
            .from('movies')
            .select('*')
            .eq('id', req.params.id)
            .single();
        
        if (movieError) {
            if (movieError.code === 'PGRST116') {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Película no encontrada' 
                });
            }
            throw movieError;
        }
        
        // Get streaming providers for this movie
        const { data: streamingData, error: streamingError } = await supabase
            .from('movie_streaming')
            .select(`
                type,
                streaming_providers (
                    id,
                    name,
                    logo_path
                )
            `)
            .eq('movie_id', req.params.id);
        
        if (streamingError) throw streamingError;
        
        // Organize streaming data by type
        const streaming = {
            flatrate: [],
            rent: [],
            buy: []
        };
        
        streamingData.forEach(item => {
            if (item.streaming_providers) {
                streaming[item.type].push(item.streaming_providers);
            }
        });
        
        // Add streaming info to movie object
        movie.streaming_providers = streaming;
        
        res.json({ success: true, data: movie });
    } catch (error) {
        console.error('Error in /api/movies/:id:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get streaming providers for a specific movie
app.get('/api/movies/:id/streaming-providers', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('movie_streaming')
            .select(`
                type,
                streaming_providers (
                    id,
                    name,
                    logo_path,
                    display_priority
                )
            `)
            .eq('movie_id', req.params.id);
        
        if (error) throw error;
        
        // Organize by type
        const result = {
            flatrate: [],
            rent: [],
            buy: []
        };
        
        data.forEach(item => {
            if (item.streaming_providers) {
                result[item.type].push(item.streaming_providers);
            }
        });
        
        // Sort by display_priority
        Object.keys(result).forEach(type => {
            result[type].sort((a, b) => a.display_priority - b.display_priority);
        });
        
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in /api/movies/:id/streaming-providers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
        
        // If no rating exists, return null (not an error)
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
            .neq('user_id', userId || 'no-user') // Exclude current user
            .not('rating', 'is', null); // Only users who have rated
        
        if (error) throw error;
        
        // Transform data to flatten structure
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
        
        // Upsert (insert or update)
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
        
        // Add watched_date if marking as watched
        if (watched) {
            updateData.watched_date = new Date().toISOString();
        } else {
            updateData.watched_date = null;
        }
        
        // Upsert
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
});
