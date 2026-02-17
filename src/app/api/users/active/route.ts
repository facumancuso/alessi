import { NextResponse } from 'next/server';
import { getActiveUsers } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const users = await getActiveUsers();
        return NextResponse.json(users);
    } catch (error) {
        console.error('Error al obtener usuarios activos:', error);
        return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
    }
}
