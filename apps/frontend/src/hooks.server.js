export const handle = async ({ event, resolve }) => {
    // Get the session cookie from the browser
    const sessionToken = event.cookies.get("session_token");

    if (!sessionToken) {
        event.locals.user = null;
        return resolve(event);
    }

    // Send the cookie to our backend to validate the session
    const response = await fetch("http://localhost:3000/api/me", {
        headers: {
            // Forward the cookie to the backend API
            cookie: `session_token=${sessionToken}`,
        },
    });

    if (response.ok) {
        const data = await response.json();
        event.locals.user = data.user; // `user` is now available on `event.locals`
    } else {
        event.locals.user = null;
    }

    return resolve(event);
};
