const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= SUPABASE ================= */

const SUPABASE_URL = 'https://nhomhjvscougplrlxczm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ================= MIDDLEWARE ================= */

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

/* ================= HEALTH ================= */

app.get('/api/health', (req, res) => {
    res.json({ success: true });
});

/* ================= STREAMING PROVIDERS ================= */

app.get('/api/streaming-providers', async (req, res) => {
    const { data, error } = await supabase
        .from('streaming_providers')
        .select('id, name, logo_path, display_priority')
        .order('display_priority');

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
});

/* ================= MOVIES ================= */

// Populares
app.get('/api/movies/popular', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;

    const { data, error } = await supabase
        .from('movies')
        .select(`
            id,
            title,
            poster_path,
            backdrop_path,
            popularity,
            vote_average,
            release_date
        `)
        .order('popularity', { ascending: false })
        .limit(limit);

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
});

// Por plataforma
app.get('/api/streaming-providers/:id/movies', async (req, res) => {
    const providerId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type || 'flatrate';

    const { data, error } = await supabase
        .from('movie_streaming')
        .select(`
            movies (
                id,
                title,
                poster_path,
                backdrop_path,
                popularity,
                vote_average,
                release_date
            )
        `)
        .eq('provider_id', providerId)
        .eq('type', type)
        .limit(limit);

    if (error) return res.status(500).json({ success: false, error: error.message });

    const movies = data
        .map(r => r.movies)
        .filter(Boolean)
        .sort((a, b) => b.popularity - a.popularity);

    res.json({ success: true, data: movies });
});

// Detalle de película
app.get('/api/movies/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('movies')
        .select('*')
        .eq('id', req.params.id)
        .single();

    if (error) return res.status(404).json({ success: false, error: 'Película no encontrada' });
    res.json({ success: true, data });
});

/* ================= USER RATINGS ================= */

// Rating del usuario
app.get('/api/movies/:id/user-rating', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'userId requerido' });
    }

    const { data, error } = await supabase
        .from('user_movie_ratings')
        .select('rating, watched')
        .eq('movie_id', req.params.id)
        .eq('user_id', userId)
        .single();

    if (error && error.code === 'PGRST116') {
        return res.json({ success: true, data: null });
    }

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
});

// Valorar película
app.post('/api/movies/:id/rate', async (req, res) => {
    const { userId, rating } = req.body;

    if (!userId || rating == null || rating < 1 || rating > 10) {
        return res.status(400).json({ success: false, error: 'Rating inválido' });
    }

    const { data, error } = await supabase
        .from('user_movie_ratings')
        .upsert({
            user_id: userId,
            movie_id: parseInt(req.params.id),
            rating,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,movie_id' })
        .select()
        .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
});

// Marcar vista
app.post('/api/movies/:id/watched', async (req, res) => {
    const { userId, watched } = req.body;

    if (!userId || watched === undefined) {
        return res.status(400).json({ success: false, error: 'Datos inválidos' });
    }

    const { data, error } = await supabase
        .from('user_movie_ratings')
        .upsert({
            user_id: userId,
            movie_id: parseInt(req.params.id),
            watched,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,movie_id' })
        .select()
        .single();

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, data });
});

/* ================= 404 ================= */

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint no encontrado' });
});

/* ================= START ================= */

app.listen(PORT, () => {
    console.log(`🚀 Backend listo en http://localhost:${PORT}`);
});
