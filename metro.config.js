const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = withNativeWind(getDefaultConfig(__dirname), {
  input: './src/global.css',
});

function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  for (const file of ['.env.local', '.env']) {
    try {
      const contents = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      for (const line of contents.split('\n')) {
        const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && match[1] === name) {
          return match[2].replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      // Missing env files simply mean no proxy target is configured.
    }
  }
  return '';
}

const apiTarget = readEnvValue('EXPO_PUBLIC_API_BASE_URL').replace(/\/$/, '');

// Browser builds send an `Origin` header, and the deployed API only answers
// CORS for the origins listed in its CORS_ORIGINS. Serving the API through the
// Metro dev server keeps web requests same-origin, so `expo start --web` works
// without allow-listing localhost in production. Native builds talk to the API
// directly and never see this middleware.
const API_PREFIX = '/__proxy-api';
const SOCKET_PREFIX = '/__proxy-socket.io';

function proxyApi(middleware) {
  return (req, res, next) => {
    const url = req.url || '';
    const isApi = url === API_PREFIX || url.startsWith(`${API_PREFIX}/`);
    const isSocket = url === SOCKET_PREFIX || url.startsWith(`${SOCKET_PREFIX}/`);
    if (!apiTarget || (!isApi && !isSocket)) {
      return middleware(req, res, next);
    }

    const target = new URL(apiTarget);
    const upstreamPath = isSocket
      ? url.replace(SOCKET_PREFIX, '/socket.io')
      : url.slice(API_PREFIX.length) || '/';
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers['keep-alive'];
    delete headers['content-length'];
    delete headers.origin;
    delete headers.referer;
    headers.host = target.host;

    const transport = target.protocol === 'http:' ? http : https;
    const upstream = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'http:' ? 80 : 443),
        method: req.method,
        path: upstreamPath,
        headers,
      },
      (upstreamResponse) => {
        res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(res);
      },
    );

    upstream.on('error', (error) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          message: `Metro could not reach ${apiTarget}: ${error.message}`,
        }),
      );
    });

    req.pipe(upstream);
  };
}

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => proxyApi(middleware),
};

module.exports = config;
