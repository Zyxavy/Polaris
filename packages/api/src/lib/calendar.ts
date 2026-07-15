export function dayToBit(day: number): number {
    return 1 << day; //0-mon, 1-tue... to 6-sun
}

export function encodeDaysToBitmask(days: number[]): number {
    return days.reduce((mask, day) => mask | dayToBit(day), 0);
}

export function decodeBitmaskToDays(bitmask: number): number[] {
    const days: number[] = [];
    for (let i = 0; i < 7; i++) {
        if (bitmask & (1 << i)) days.push(i);
    }
    return days;
}

export function dayMatchesBitmask(day: number, bitmask: number): boolean {
    return (bitmask & dayToBit(day)) !== 0;
}

export function toManilaDate(utcDate: Date = new Date()): string {
    return utcDate.toLocaleDateString('en-CA', {timeZone: 'Asia/Manila'});
}

export function tomorrowManilaDate(): string {
    const now = new Date();
    
    const formatter = new Intl.DateTimeFormat('en-Ca', { timeZone: 'Asia/Manila'});
    const todayParts = formatter.formatToParts(now);
    const todayStr = formatter.format(now); // YYYY-MM-DD
    const [y, m, d] = todayStr.split('-').map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
    return formatter.format(tomorrow);
}

export function todayBit(): number {
  return dateToBit(toManilaDate());
}

export function dateToBit(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const polarisDay = (jsDay + 6) % 7;
  return 1 << polarisDay;
}