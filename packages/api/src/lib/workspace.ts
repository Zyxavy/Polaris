const CURRENT_LAYOUT_VERSION = 1;

export function upgradeLayout(layout: unknown): { v: number; widgets: any[] } {
    if (!layout || typeof(layout) !== 'object') {
        return { v: CURRENT_LAYOUT_VERSION, widgets: [] };
    }
    const input = layout as { v?: number, widgets?: any[] };
    // Future version upgrade chain:
    // let v = input.v ?? 0;
    // while (v < CURRENT_LAYOUT_VERSION) {
    //   if (v === 1) { layout = upgradeV1toV2(layout); v = 2; }
    //   else break;
    // }

    return { v: CURRENT_LAYOUT_VERSION, widgets: input.widgets ?? [] };
}