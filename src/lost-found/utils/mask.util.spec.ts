import { maskPhone } from './mask.util';

describe('maskPhone', () => {
  it('keeps the first 4 and last 2 characters', () => {
    expect(maskPhone('+2348031234567')).toBe('+234*****67');
    expect(maskPhone('08031234567')).toBe('0803*****67');
  });

  it('ignores spaces, dashes and brackets', () => {
    expect(maskPhone('(0803) 123-4567')).toBe('0803*****67');
  });

  it('fully masks very short values and handles missing ones', () => {
    expect(maskPhone('12345')).toBe('*****');
    expect(maskPhone(undefined)).toBe('');
    expect(maskPhone(null)).toBe('');
  });
});
