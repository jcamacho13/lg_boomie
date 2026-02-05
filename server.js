const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = 'https://nhomhjvscougplrlxczm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ob21oanZzY291Z3Bscmx4Y3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5Njk3MzAsImV4cCI6MjA4NTU0NTczMH0.84mcONf4cqmypXKqN7EoDYsy6K9IFUmEbwtQ3iYQQ6Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'OK' });
});

app.get('/api/movies/recommendations', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, popularity')
            .order('popularity', { ascending: false })
            .limit(5);
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/movies/popular', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 5;
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, backdrop_path, popularity')
            .order('popularity', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/genres', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('genres')
            .select('id, name')
            .order('name', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/genres/:id/movies', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('movie_genres')
            .select('movie_id, movies(id, title, backdrop_path, popularity)')
            .eq('genre_id', req.params.id)
            .limit(20);
        if (error) throw error;
        const movies = data.map(item => item.movies).sort((a, b) => b.popularity - a.popularity);
        res.json({ success: true, data: movies });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

});
