import { getReviewDay } from '$lib/api/reviews';

export async function load() {
    const data = await getReviewDay();
    return { due: data.due };
}