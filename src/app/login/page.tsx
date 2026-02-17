import { getActiveUsers } from '@/lib/data';
import LoginForm from './login-form';

export default async function LoginPage() {
  const users = await getActiveUsers();

  return <LoginForm users={users} />;
}
