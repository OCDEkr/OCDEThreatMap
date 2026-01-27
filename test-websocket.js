const http = require('http');
const WebSocket = require('ws');

// First, login to get session cookie
function login() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username: 'admin', password: 'testpass' });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const cookies = res.headers['set-cookie'];
        resolve(cookies);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testWebSocket() {
  // Test 1: Try to connect without authentication
  console.log('=== Test 1: WebSocket without authentication ===');
  const ws1 = new WebSocket('ws://localhost:3000');
  
  ws1.on('error', (err) => {
    console.log('Expected error (no auth):', err.message);
  });
  
  ws1.on('unexpected-response', (req, res) => {
    console.log('Status:', res.statusCode, res.statusMessage);
    console.log('Correctly rejected unauthenticated connection');
  });

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Login and connect with authentication
  console.log('\n=== Test 2: WebSocket with authentication ===');
  const cookies = await login();
  console.log('Logged in successfully');

  const ws2 = new WebSocket('ws://localhost:3000', {
    headers: {
      Cookie: cookies.join('; ')
    }
  });

  ws2.on('open', () => {
    console.log('WebSocket connected successfully!');
    
    // Test heartbeat (wait for ping)
    setTimeout(() => {
      console.log('\nConnection established and stable');
      ws2.close();
      process.exit(0);
    }, 2000);
  });

  ws2.on('ping', () => {
    console.log('Received ping from server (heartbeat working)');
  });

  ws2.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    process.exit(1);
  });

  ws2.on('close', () => {
    console.log('WebSocket closed');
  });
}

setTimeout(() => {
  testWebSocket().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}, 2000);
