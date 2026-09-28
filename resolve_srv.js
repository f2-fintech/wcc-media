const https = require('https');

https.get('https://dns.google/resolve?name=_mongodb._tcp.f2fintech.t390pwj.mongodb.net&type=SRV', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("SRV:", JSON.parse(data));
  });
});
https.get('https://dns.google/resolve?name=f2fintech.t390pwj.mongodb.net&type=TXT', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("TXT:", JSON.parse(data));
  });
});
