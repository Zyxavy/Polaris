import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;

export async function getMongoClient(uri: string): Promise<MongoClient> {
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
    }
    
    return client;
}