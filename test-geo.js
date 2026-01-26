const { GeoLocator } = require('./src/enrichment/geolocation.js');

async function test() {
  const locator = new GeoLocator();
  await locator.initialize();

  // Test public IP (Google DNS)
  const result = locator.get('8.8.8.8');
  console.log('8.8.8.8:', result);

  // Test invalid IP
  const invalid = locator.get('invalid');
  console.log('invalid IP:', invalid);

  // Test private IP
  const privateIP = locator.get('192.168.1.1');
  console.log('192.168.1.1:', privateIP);
}

test().catch(console.error);
