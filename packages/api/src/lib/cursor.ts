export function encodeDateCursor(date: string, id: string): string {
    return btoa(JSON.stringify({ d: date, i: id }));
}

export function decodeDateCursor(cursor: string): { date: string; id: string } | null {
    try {
        const parsed = JSON.parse(atob(cursor));
        if (typeof parsed.d === 'string' && typeof parsed.i === 'string') {
            return { date: parsed.d, id: parsed.i };
        }
        return null;
    } catch {
        return null;
    }
}
