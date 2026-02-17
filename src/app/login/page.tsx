import { getActiveUsers } from '@/lib/data';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const users = await getActiveUsers();

  return <LoginForm users={users} />;
}
