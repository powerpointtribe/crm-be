import { ConfigService } from '@nestjs/config';
import { csvCell } from './services/donations.service';
import {
  FlutterwaveClient,
  FlutterwaveError,
} from './services/flutterwave.client';

describe('csvCell', () => {
  it('quotes every cell and doubles embedded quotes', () => {
    expect(csvCell('Ada')).toBe('"Ada"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a,b\nc')).toBe('"a,b\nc"');
  });

  it('neutralises every formula trigger (=, +, -, @, tab, CR)', () => {
    for (const c of ['=', '+', '-', '@', '\t', '\r']) {
      expect(csvCell(`${c}cmd`)).toBe(`"'${c}cmd"`);
    }
    expect(csvCell('=HYPERLINK("http://x")')).toBe(
      `"'=HYPERLINK(""http://x"")"`,
    );
  });

  it('leaves safe values alone and blanks null/undefined', () => {
    expect(csvCell(5000)).toBe('"5000"');
    expect(csvCell('a=b')).toBe('"a=b"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe('FlutterwaveClient', () => {
  const client = (key?: string) =>
    new FlutterwaveClient({
      get: (k: string) => (k === 'FLUTTERWAVE_SECRET_KEY' ? key : undefined),
    } as unknown as ConfigService);
  let fetchMock: jest.SpyInstance;

  afterEach(() => fetchMock?.mockRestore());

  it('is configured only with a secret key', () => {
    expect(client().isConfigured).toBe(false);
    expect(client('FLWSECK_TEST-x').isConfigured).toBe(true);
  });

  it('returns the hosted payment link and sends the bearer key', async () => {
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        Response.json({ status: 'success', data: { link: 'https://pay/x' } }),
      );
    await expect(
      client('k').createPaymentLink({ tx_ref: 'PPTG-1' }),
    ).resolves.toBe('https://pay/x');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.flutterwave.com/v3/payments');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer k',
    );
  });

  it('throws FlutterwaveError when the provider refuses or is unreachable', async () => {
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(Response.json({ status: 'error' }))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(client('k').createPaymentLink({})).rejects.toBeInstanceOf(
      FlutterwaveError,
    );
    await expect(client('k').createPaymentLink({})).rejects.toBeInstanceOf(
      FlutterwaveError,
    );
  });

  it('verifyByReference returns the transaction, or null when unknown/unreachable', async () => {
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          status: 'success',
          data: { status: 'successful', amount: 100 },
        }),
      )
      .mockResolvedValueOnce(Response.json({ status: 'error' }))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    const c = client('k');
    await expect(c.verifyByReference('PPTG-a b')).resolves.toEqual({
      status: 'successful',
      amount: 100,
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain('tx_ref=PPTG-a%20b');
    await expect(c.verifyByReference('x')).resolves.toBeNull();
    await expect(c.verifyByReference('x')).resolves.toBeNull();
  });
});
