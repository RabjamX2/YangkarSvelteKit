<script>
  let username = '';
  let password = '';
  let error = '';
  let user = null;

  async function handleLogin() {
    error = '';
    const res = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include' // Ensure cookies are sent/received
    });
    const data = await res.json();
    if (!res.ok) {
      error = data.error || 'Login failed';
    } else {
      // Fetch current user info after login
      const userRes = await fetch('http://localhost:3000/api/me', {
        credentials: 'include'
      });
      const userData = await userRes.json();
      user = userData.user;
    }
  }
</script>

{#if user}
  <p>Welcome, {user.username}!</p>
{:else}
  <form on:submit|preventDefault={handleLogin}>
    <input type="text" bind:value={username} placeholder="Username" required />
    <input type="password" bind:value={password} placeholder="Password" required />
    <button type="submit">Login</button>
    {#if error}
      <p style="color:red">{error}</p>
    {/if}
  </form>
{/if}
