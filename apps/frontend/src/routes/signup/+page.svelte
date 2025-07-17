<script>
  let username = '';
  let password = '';
  let error = '';
  async function handleSignup() {
    error = '';
    const res = await fetch('http://localhost:3000/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      error = data.error || 'Signup failed';
    } else {
      // Handle successful signup (e.g., store user info, redirect)
      alert('Signup successful!');
    }
  }
</script>

<form on:submit|preventDefault={handleSignup}>
  <input type="text" bind:value={username} placeholder="Username" required />
  <input type="password" bind:value={password} placeholder="Password" required />
  <button type="submit">Sign Up</button>
  {#if error}
    <p style="color:red">{error}</p>
  {/if}
</form>
