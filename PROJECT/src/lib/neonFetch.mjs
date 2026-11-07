import https from 'node:https';
import dns from 'node:dns';

const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);

export function customNeonFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = options.headers || {};
    const method = options.method || 'GET';
    const body = options.body;

    const req = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: method,
      headers: headers,
      lookup: (hostname, opts, cb) => {
        if (typeof opts === 'function') {
          cb = opts;
          opts = {};
        }
        resolver.resolve4(hostname, (err, addrs) => {
          if (err || !addrs || addrs.length === 0) {
            return cb(err || new Error(`No IP for ${hostname}`));
          }
          if (opts && opts.all) {
            return cb(null, addrs.map(a => ({ address: a, family: 4 })));
          }
          return cb(null, addrs[0], 4);
        });
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          text: async () => raw,
          json: async () => JSON.parse(raw),
          headers: new Headers(res.headers)
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}
