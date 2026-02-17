
'use client';
import { useEffect, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createUser, updateUser } from '@/lib/auth-actions';
import type { User } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/app/admin/user-context';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Partial<User> | null;
}

const allRoles: User['role'][] = ['Superadmin', 'Gerente', 'Recepcion', 'Peluquero'];

export function UserModal({ isOpen, onClose, user }: UserModalProps) {
  const { currentUser } = useCurrentUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<User['role']>('Peluquero');
  const [password, setPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'Peluquero');
    } else {
      setName('');
      setEmail('');
      setRole('Peluquero');
    }
    setPassword('');
  }, [user]);

  const handleSave = () => {
    startTransition(async () => {
        const userData: Partial<User> = { name, email, role, isActive: user?.isActive ?? true };
        if (password) {
            userData.password = password;
        }

        try {
            if (user && user.id) {
                await updateUser(user.id, userData);
                toast({ title: "Usuario actualizado", description: "El usuario se ha guardado correctamente." });
            } else {
                 if (!password) {
                    toast({ variant: "destructive", title: "Error", description: "La contraseña es obligatoria para nuevos usuarios." });
                    return;
                }
                await createUser(userData as User);
                toast({ title: "Usuario creado", description: "El nuevo usuario se ha añadido a la lista." });
            }
            onClose();
        } catch(error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo guardar el usuario." });
        }
    });
  }

  const availableRoles = allRoles.filter(r => {
    if (currentUser?.role === 'Superadmin') return true;
    if (currentUser?.role === 'Gerente') return r === 'Peluquero' || r === 'Recepcion';
    return false;
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={user ? 'Dejar en blanco para no cambiar' : 'Establecer contraseña'}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select value={role} onValueChange={(value) => setRole(value as User['role'])}>
                <SelectTrigger id="role">
                    <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                    {availableRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
