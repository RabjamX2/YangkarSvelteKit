<script>
  let username = '';
  let password = '';
  let error = '';
  async function handleLogin() {
    error = '';
    const res = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      error = data.error || 'Login failed';
    } else {
      // Handle successful login (e.g., store user info, redirect)
      alert('Login successful!');
    }
  }
</script>

<form on:submit|preventDefault={handleLogin}>
  <input type="text" bind:value={username} placeholder="Username" required />
  <input type="password" bind:value={password} placeholder="Password" required />
  <button type="submit">Login</button>
  {#if error}
    <p style="color:red">{error}</p>
  {/if}
</form>
