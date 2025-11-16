// Password protection for admin page
// Verifies password with server-side API

(async function() {
    // Check if already authenticated in this session
    const isAuthenticated = sessionStorage.getItem('admin_authenticated') === 'true';

    if (!isAuthenticated) {
        // Simple password prompt
        const password = prompt('Enter admin password to access quiz upload:');

        if (!password) {
            alert('Password is required. Access denied.');
            window.location.href = '/'; // Redirect to main quiz app
            return;
        }

        try {
            // Verify password with API
            const response = await fetch('/api/verify-admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Authentication successful
                sessionStorage.setItem('admin_authenticated', 'true');
            } else {
                // Authentication failed
                alert('Incorrect password. Access denied.');
                window.location.href = '/'; // Redirect to main quiz app
            }
        } catch (error) {
            console.error('Authentication error:', error);
            alert('Authentication error. Please try again.');
            window.location.href = '/'; // Redirect to main quiz app
        }
    }
})();
