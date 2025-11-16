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
