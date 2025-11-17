-- Supabase Table Setup for Buzzer Quiz
-- Run this SQL in your Supabase SQL Editor to create the game_results table

CREATE TABLE IF NOT EXISTS game_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_code TEXT NOT NULL,
    quiz_name TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    player_scores JSONB DEFAULT '{}'::jsonb,
    player_names JSONB DEFAULT '{}'::jsonb,
    total_questions INTEGER DEFAULT 0,
    completed_questions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_results_room_code ON game_results(room_code);
CREATE INDEX IF NOT EXISTS idx_game_results_created_at ON game_results(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (for game results)
CREATE POLICY "Allow insert game results"
    ON game_results
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Create policy to allow anyone to read game results
CREATE POLICY "Allow read game results"
    ON game_results
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Optional: Add a view for leaderboard
CREATE OR REPLACE VIEW game_leaderboard AS
SELECT 
    quiz_name,
    room_code,
    started_at,
    ended_at,
    player_scores,
    player_names,
    total_questions,
    completed_questions,
    created_at
FROM game_results
ORDER BY created_at DESC;

-- Grant access to the view
GRANT SELECT ON game_leaderboard TO anon, authenticated;

