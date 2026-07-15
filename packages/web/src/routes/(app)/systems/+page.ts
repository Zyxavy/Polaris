import { getSystems } from '$lib/api/systems';
import { getDashboard } from '$lib/api/dashboard';

export async function load() {
    const [systemsData, dashboardData] = await Promise.all([
        getSystems(),
        getDashboard().catch(() => null),
    ]);

    const todayMap: Record<string, { state: string }> = {};
    if (dashboardData) {
        for (const inst of dashboardData.instances) {
            todayMap[inst.system_id] = { state: inst.state };
        }
    }

    return {
        systems: systemsData.systems,
        next_cursor: systemsData.next_cursor,
        todayMap,
    };
}
