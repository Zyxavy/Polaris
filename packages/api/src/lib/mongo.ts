import type { MongoClient } from 'mongodb';

let client: MongoClient | null = null;

export async function getMongoClient(uri: string): Promise<MongoClient> {
    if (!client) {
        const { MongoClient } = await import('mongodb');
        client = new MongoClient(uri);
        await client.connect();
    }
    return client;
}