/**
 * TLS options for the MongoDB connection.
 *
 * TLS is on unless MONGODB_TLS is exactly "false" AND NODE_ENV is not
 * "production". That lets a developer run against a plain local mongod while
 * making it impossible to switch TLS off on the production deployment.
 */
export function mongoTlsOptions(env: {
  MONGODB_TLS?: string;
  NODE_ENV?: string;
}): { ssl: boolean; tls: boolean; tlsInsecure: false } {
  const tls = !(env.MONGODB_TLS === 'false' && env.NODE_ENV !== 'production');
  return { ssl: tls, tls, tlsInsecure: false };
}
