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

