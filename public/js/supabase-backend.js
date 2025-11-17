// Supabase Backend Integration for Multiplayer
// Free tier: https://supabase.com/pricing

class SupabaseBackend {
    constructor(supabaseUrl, supabaseKey) {
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.client = null;
        this.channel = null;
        this.roomCode = null;
        this.connected = false;
    }

    async init(roomCode) {
        this.roomCode = roomCode;

        // Dynamically import Supabase client
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

        this.client = createClient(this.supabaseUrl, this.supabaseKey);

        // Subscribe to room channel
        this.channel = this.client.channel(`room:${roomCode}`, {
            config: {
                broadcast: { self: true }
            }
        });

        this.connected = true;
        return this;
    }

    // Subscribe to messages
    subscribe(callback) {
        if (!this.channel) {
            console.error('Channel not initialized');
            return;
        }

        this.channel
            .on('broadcast', { event: 'game-event' }, ({ payload }) => {
                callback({ data: payload });
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Connected to Supabase realtime');
                }
            });
    }

    // Broadcast message to all players
    broadcast(data) {
        if (!this.channel) {
            console.error('Channel not initialized');
            return;
        }

        this.channel.send({
            type: 'broadcast',
            event: 'game-event',
            payload: data
        });
    }

    // Save game results to database
    async saveGameResults(gameData) {
        if (!this.client) {
            console.error('Supabase client not initialized');
            return { error: 'Client not initialized' };
        }

        try {
            const { data, error } = await this.client
                .from('game_results')
                .insert({
                    room_code: this.roomCode,
                    quiz_name: gameData.quizName || 'Unknown',
                    started_at: gameData.startedAt || new Date().toISOString(),
                    ended_at: new Date().toISOString(),
                    player_scores: gameData.scores || {},
                    player_names: gameData.playerNames || {},
                    total_questions: gameData.totalQuestions || 0,
                    completed_questions: gameData.completedQuestions || 0
                })
                .select();

            if (error) {
                console.error('Error saving game results:', error);
                return { error: error.message };
            }

            console.log('✅ Game results saved:', data);
            return { data };
        } catch (error) {
            console.error('Exception saving game results:', error);
            return { error: error.message };
        }
    }

    // Clean up
    disconnect() {
        if (this.channel) {
            this.client.removeChannel(this.channel);
        }
        this.connected = false;
    }

    isConnected() {
        return this.connected;
    }
}

// Export for use in multiplayer.js
window.SupabaseBackend = SupabaseBackend;
