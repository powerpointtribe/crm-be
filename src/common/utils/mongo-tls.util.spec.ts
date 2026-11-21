import { mongoTlsOptions } from './mongo-tls.util';

describe('mongoTlsOptions', () => {
  const on = { ssl: true, tls: true, tlsInsecure: false };
  const off = { ssl: false, tls: false, tlsInsecure: false };

  it('keeps TLS on when MONGODB_TLS is unset (current production behaviour)', () => {
    expect(mongoTlsOptions({})).toEqual(on);
    expect(mongoTlsOptions({ NODE_ENV: 'production' })).toEqual(on);
  });

  it('turns TLS off only for MONGODB_TLS=false outside production', () => {
    expect(
      mongoTlsOptions({ MONGODB_TLS: 'false', NODE_ENV: 'development' }),
    ).toEqual(off);
    expect(mongoTlsOptions({ MONGODB_TLS: 'false' })).toEqual(off);
  });

  it('ignores MONGODB_TLS=false in production', () => {
    expect(
      mongoTlsOptions({ MONGODB_TLS: 'false', NODE_ENV: 'production' }),
    ).toEqual(on);
  });

  it('treats any other value as on', () => {
    for (const v of ['true', 'FALSE', '0', 'no', '']) {
      expect(
        mongoTlsOptions({ MONGODB_TLS: v, NODE_ENV: 'development' }),
      ).toEqual(on);
    }
  });
});
