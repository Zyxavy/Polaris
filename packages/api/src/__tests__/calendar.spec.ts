import { describe, it, expect } from 'vitest';
import { dayToBit, encodeDaysToBitmask, decodeBitmaskToDays, dayMatchesBitmask } from '../lib/calendar';

describe('dayToBit', () => {
    it('maps 0 (Monday) to 1', () => expect(dayToBit(0)).toBe(1));
    it('maps 1 (Tuesday) to 2', () => expect(dayToBit(1)).toBe(2));
    it('maps 2 (Wednesday) to 4', () => expect(dayToBit(2)).toBe(4));
    it('maps 6 (Sunday) to 64', () => expect(dayToBit(6)).toBe(64));
});

describe('encodeDaysToBitmask', () => {
    it('encodes Monday alone as 1', () => expect(encodeDaysToBitmask([0])).toBe(1));
    it('encodes Mon+Wed+Fri as 1+4+16=21', () => expect(encodeDaysToBitmask([0, 2, 4])).toBe(21));
    it('encodes Mon+Sun as 1+64=65', () => expect(encodeDaysToBitmask([0, 6])).toBe(65));
    it('encodes all 7 days as 127', () => expect(encodeDaysToBitmask([0, 1, 2, 3, 4, 5, 6])).toBe(127));
    it('encodes empty array as 0', () => expect(encodeDaysToBitmask([])).toBe(0));
});

describe('decodeBitmaskToDays', () => {
    it('decodes 1 back to [0]', () => expect(decodeBitmaskToDays(1)).toEqual([0]));
    it('decodes 21 back to [0, 2, 4]', () => expect(decodeBitmaskToDays(21)).toEqual([0, 2, 4]));
    it('decodes 65 back to [0, 6]', () => expect(decodeBitmaskToDays(65)).toEqual([0, 6]));
    it('decodes 127 back to [0,1,2,3,4,5,6]', () => expect(decodeBitmaskToDays(127)).toEqual([0, 1, 2, 3, 4, 5, 6]));
    it('decodes 0 as empty array', () => expect(decodeBitmaskToDays(0)).toEqual([]));
    it('round-trips encode→decode', () => {
        expect(decodeBitmaskToDays(encodeDaysToBitmask([1, 3, 5]))).toEqual([1, 3, 5]);
    });
});

describe('dayMatchesBitmask', () => {
    const bitmask = encodeDaysToBitmask([0, 2, 4]); // Mon, Wed, Fri = bitmask 21

    it('returns true for Monday (day 0)', () => expect(dayMatchesBitmask(0, bitmask)).toBe(true));
    it('returns false for Tuesday (day 1)', () => expect(dayMatchesBitmask(1, bitmask)).toBe(false));
    it('returns true for Wednesday (day 2)', () => expect(dayMatchesBitmask(2, bitmask)).toBe(true));
    it('returns false for Thursday (day 3)', () => expect(dayMatchesBitmask(3, bitmask)).toBe(false));
    it('returns true for Friday (day 4)', () => expect(dayMatchesBitmask(4, bitmask)).toBe(true));
    it('returns false for Saturday (day 5)', () => expect(dayMatchesBitmask(5, bitmask)).toBe(false));
    it('returns false for Sunday (day 6)', () => expect(dayMatchesBitmask(6, bitmask)).toBe(false));

    describe('edge case: bitmask 0 (no days)', () => {
        it('returns false for every day', () => {
            for (let d = 0; d < 7; d++) {
                expect(dayMatchesBitmask(d, 0)).toBe(false);
            }
        });
    });

    describe('edge case: bitmask 127 (all days)', () => {
        it('returns true for every day', () => {
            for (let d = 0; d < 7; d++) {
                expect(dayMatchesBitmask(d, 127)).toBe(true);
            }
        });
    });
});
