import { getActiveUsers } from '@/lib/data';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  try {
    const users = await getActiveUsers();

    return <LoginForm users={users} />;
  } catch (error) {
    console.error('Error cargando usuarios activos para login:', error);

    return <LoginForm users={[]} dbError />;
  }

}
