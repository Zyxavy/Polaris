import { getReviews } from '$lib/api/reviews';

export async function load({ params }: { params: Record<string, string> }) {
    const data = await getReviews(params.id);
    return { reviews: data.reviews, next_cursor: data.next_cursor, systemId: params.id };
}