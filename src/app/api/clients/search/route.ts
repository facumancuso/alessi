import { NextResponse } from 'next/server';
import { searchClients } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim();
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) ? limitParam : 40;

    if (query.length < 2) {
      return NextResponse.json([]);
    }

    const clients = await searchClients(query, limit);
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error buscando clientes:', error);
    return NextResponse.json({ error: 'Error al buscar clientes' }, { status: 500 });
  }
}
