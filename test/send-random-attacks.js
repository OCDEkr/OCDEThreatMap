#!/usr/bin/env node
/**
 * send-random-attacks.js
 *
 * Sends random simulated attack events to the syslog receiver for testing.
 * Default: 5 events per second for 5 minutes (1500 total events)
 *
 * Usage:
 *   node test/send-random-attacks.js                    # Default settings
 *   node test/send-random-attacks.js --rate 10          # 10 per second
 *   node test/send-random-attacks.js --duration 60      # Run for 60 seconds
 *   node test/send-random-attacks.js --port 514         # Send to port 514
 */

const dgram = require('dgram');

// Configuration
const config = {
  host: '127.0.0.1',
  port: parseInt(process.env.SYSLOG_PORT) || 5514,
  rate: 5,           // Events per second
  duration: 300      // Duration in seconds (5 minutes)
};

// Parse command line arguments
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--rate' && process.argv[i + 1]) {
    config.rate = parseInt(process.argv[i + 1]);
    i++;
  } else if (process.argv[i] === '--duration' && process.argv[i + 1]) {
    config.duration = parseInt(process.argv[i + 1]);
    i++;
  } else if (process.argv[i] === '--port' && process.argv[i + 1]) {
    config.port = parseInt(process.argv[i + 1]);
    i++;
  } else if (process.argv[i] === '--host' && process.argv[i + 1]) {
    config.host = process.argv[i + 1];
    i++;
  }
}

// Random data pools
const threatTypes = ['malware', 'intrusion', 'ddos', 'spyware', 'vulnerability', 'exploit', 'brute-force'];

// Real-world source IPs from various countries (public IP ranges)
const sourceIPs = [
  // Russia
  '5.45.192.100', '31.13.24.50', '46.161.9.25', '77.88.21.100', '95.181.176.50',
  // China
  '1.0.1.100', '14.18.240.50', '27.115.124.100', '36.99.136.50', '42.81.40.100',
  '101.71.37.50', '111.206.221.100', '116.213.127.50', '123.125.71.100', '180.76.76.50',
  // North Korea (DPRK allocated ranges)
  '175.45.176.100', '175.45.177.50', '175.45.178.100', '175.45.179.50',
  // Iran
  '2.144.0.100', '5.160.0.50', '31.2.0.100', '37.156.28.50', '46.224.0.100',
  // Brazil
  '177.0.0.100', '177.12.0.50', '186.192.0.100', '189.0.0.50', '200.147.0.100',
  // India
  '14.139.0.100', '27.56.0.50', '49.44.0.100', '59.144.0.50', '103.21.124.100',
  // Germany
  '46.101.0.100', '78.46.0.50', '85.214.0.100', '138.201.0.50', '144.76.0.100',
  // Netherlands
  '31.3.0.100', '46.166.0.50', '77.247.0.100', '89.188.0.50', '93.174.0.100',
  // Ukraine
  '31.28.0.100', '37.73.0.50', '46.118.0.100', '77.120.0.50', '91.196.0.100',
  // Vietnam
  '14.160.0.100', '27.64.0.50', '42.112.0.100', '58.186.0.50', '113.160.0.100',
  // Indonesia
  '36.64.0.100', '43.252.0.50', '103.10.0.100', '110.136.0.50', '114.4.0.100',
  // Pakistan
  '39.32.0.100', '58.65.0.50', '103.4.0.100', '111.68.0.50', '119.73.0.100',
  // Romania
  '5.2.0.100', '31.5.0.50', '79.112.0.100', '86.120.0.50', '109.163.0.100',
  // Turkey
  '31.145.0.100', '46.2.0.50', '78.160.0.100', '85.96.0.50', '95.0.0.100',
  // Argentina
  '168.197.0.100', '181.1.0.50', '186.0.0.100', '190.0.0.50', '200.0.0.100',
  // Mexico
  '148.244.0.100', '187.157.0.50', '189.203.0.100', '200.38.0.50', '201.144.0.100',
  // South Africa
  '41.0.0.100', '102.0.0.50', '105.0.0.100', '154.0.0.50', '160.0.0.100',
  // Australia
  '1.120.0.100', '14.200.0.50', '27.32.0.100', '49.176.0.50', '101.0.0.100',
  // Japan
  '14.0.0.100', '27.80.0.50', '42.144.0.100', '60.32.0.50', '101.102.0.100',
  // South Korea
  '1.208.0.100', '14.32.0.50', '27.0.0.100', '39.0.0.50', '58.224.0.100',
  // France
  '2.0.0.100', '5.39.0.50', '31.0.0.100', '37.59.0.50', '51.15.0.100',
  // UK
  '2.24.0.100', '5.64.0.50', '31.48.0.100', '37.128.0.50', '51.36.0.100',
  // Poland
  '5.172.0.100', '31.0.0.50', '37.47.0.100', '46.134.0.50', '77.65.0.100',
  // Nigeria
  '41.58.0.100', '41.184.0.50', '41.203.0.100', '102.89.0.50', '105.112.0.100',
  // Egypt
  '41.32.0.100', '41.44.0.50', '41.65.0.100', '102.40.0.50', '196.219.0.100'
];

// OCDE destination IPs (configured ranges)
const destinationIPs = [
  '192.168.1.10', '192.168.1.20', '192.168.1.30', '192.168.1.50', '192.168.1.100',
  '192.168.1.150', '192.168.1.200', '192.168.1.250',
  '10.0.0.10', '10.0.0.50', '10.0.0.100', '10.0.1.10', '10.0.1.50',
  '10.0.2.10', '10.0.5.100', '10.0.10.50',
  '172.16.0.10', '172.16.0.50', '172.16.1.10', '172.16.5.100'
];

const protocols = ['tcp', 'udp'];
const ports = [22, 23, 25, 53, 80, 443, 445, 993, 1433, 3306, 3389, 5432, 5900, 8080, 8443];

// Helper functions
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPort() {
  // Mix of common ports and random high ports
  return Math.random() > 0.7 ? Math.floor(Math.random() * 64000) + 1024 : randomElement(ports);
}

function generateTimestamp() {
  return new Date().toISOString();
}

function generateSyslogMessage() {
  const src = randomElement(sourceIPs);
  const dst = randomElement(destinationIPs);
  const threatType = randomElement(threatTypes);
  const proto = randomElement(protocols);
  const sport = randomPort();
  const dport = randomElement(ports);
  const timestamp = generateTimestamp();

  // Use structured data format (RFC 5424 with pan structured data)
  return `<14>1 ${timestamp} PA-5220 - - - [pan@0 src=${src} dst=${dst} action=deny threat_type=${threatType} sport=${sport} dport=${dport} proto=${proto}] Attack blocked`;
}

// Create UDP socket
const client = dgram.createSocket('udp4');

// Stats
let sentCount = 0;
let errorCount = 0;
const startTime = Date.now();
const totalEvents = config.rate * config.duration;
const intervalMs = 1000 / config.rate;

console.log('========================================');
console.log('Random Attack Event Generator');
console.log('========================================');
console.log(`Target: ${config.host}:${config.port}`);
console.log(`Rate: ${config.rate} events/second`);
console.log(`Duration: ${config.duration} seconds`);
console.log(`Total events: ${totalEvents}`);
console.log('========================================');
console.log('Press Ctrl+C to stop early\n');

// Send events at configured rate
const sendInterval = setInterval(() => {
  const message = generateSyslogMessage();
  const buffer = Buffer.from(message);

  client.send(buffer, 0, buffer.length, config.port, config.host, (err) => {
    if (err) {
      errorCount++;
      if (errorCount === 1) {
        console.error('Send error:', err.message);
      }
    } else {
      sentCount++;

      // Progress update every 100 events
      if (sentCount % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const actualRate = (sentCount / elapsed).toFixed(1);
        console.log(`Sent: ${sentCount}/${totalEvents} | Elapsed: ${elapsed}s | Rate: ${actualRate}/s`);
      }
    }
  });

  // Check if we've sent enough
  if (sentCount >= totalEvents) {
    clearInterval(sendInterval);
    finish();
  }
}, intervalMs);

// Handle duration timeout
const durationTimeout = setTimeout(() => {
  clearInterval(sendInterval);
  finish();
}, config.duration * 1000);

// Cleanup and summary
function finish() {
  clearTimeout(durationTimeout);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const actualRate = (sentCount / elapsed).toFixed(2);

  console.log('\n========================================');
  console.log('Complete!');
  console.log('========================================');
  console.log(`Total sent: ${sentCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Duration: ${elapsed}s`);
  console.log(`Actual rate: ${actualRate} events/s`);
  console.log('========================================');

  client.close();
  process.exit(0);
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nStopping early...');
  clearInterval(sendInterval);
  finish();
});
