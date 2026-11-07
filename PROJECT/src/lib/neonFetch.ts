import https from 'node:https';
import dns from 'node:dns';

// Fallback DNS Resolver using Google and Cloudflare Public DNS
// This prevents query failure on local networks that refuse .aws.neon.tech queries.
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);

export function customNeonFetch(url: string | URL, options: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = typeof url === 'string' ? new URL(url) : url;
      const headers = options.headers || {};
      const method = options.method || 'GET';
      const body = options.body;

      const req = https.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port ? parseInt(parsed.port, 10) : 443,
          path: parsed.pathname + parsed.search,
          method: method,
          headers: headers,
          lookup: (hostname: string, opts: any, cb: any) => {
            if (typeof opts === 'function') {
              cb = opts;
              opts = {};
            }
            resolver.resolve4(hostname, (err, addrs) => {
              if (err || !addrs || addrs.length === 0) {
                // Fallback to default system lookup
                return dns.lookup(hostname, opts, cb);
              }
              if (opts && opts.all) {
                return cb(
                  null,
                  addrs.map((a) => ({ address: a, family: 4 }))
                );
              }
              return cb(null, addrs[0], 4);
            });
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve({
              ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode || 200,
              statusText: res.statusMessage || '',
              text: async () => raw,
              json: async () => {
                try {
                  return JSON.parse(raw);
                } catch {
                  return raw;
                }
              },
              headers: new Headers(res.headers as any),
            });
          });
        }
      );

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        req.write(body);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}
