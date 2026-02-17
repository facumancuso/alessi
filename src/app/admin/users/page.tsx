
'use client'
import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getUsers } from '@/lib/data';
import type { User } from '@/lib/types';
import { deleteUser, updateUser } from '@/lib/auth-actions';
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { UserModal } from '@/components/user-modal';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '../user-context';


export default function UsersPage() {
    const { currentUser } = useCurrentUser();
    const [userList, setUserList] = useState<User[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const { toast } = useToast();

    const fetchUsers = async () => {
        const allUsers = await getUsers();
        setUserList(allUsers);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleOpenModal = (user: User | null) => {
        if (!currentUser || (currentUser.role !== 'Superadmin' && currentUser.role !== 'Gerente')) return;
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setSelectedUser(null);
        setIsModalOpen(false);
        fetchUsers();
    };

    const handleDeleteUser = async (userId: string) => {
        if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
            await deleteUser(userId);
            toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado correctamente.' });
            fetchUsers();
        }
    };
    
    const canManageUser = (targetUserRole: User['role']) => {
        if (!currentUser) return false;
        if (currentUser.role === 'Superadmin') return true;
        if (currentUser.role === 'Gerente') {
            return targetUserRole === 'Peluquero' || targetUserRole === 'Recepcion';
        }
        return false;
    }

    return (
    <>
        <UserModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            user={selectedUser}
        />
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-2xl font-headline">Gestión de Usuarios</CardTitle>
                    <CardDescription>
                        Añade, edita y gestiona el acceso de los usuarios al sistema.
                    </CardDescription>
                </div>
                 {currentUser && (currentUser.role === 'Superadmin' || currentUser.role === 'Gerente') && (
                    <Button onClick={() => handleOpenModal(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir Usuario
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {userList.map(user => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </TableCell>
                                <TableCell>{user.role}</TableCell>
                                <TableCell className="text-right space-x-1">
                                     {canManageUser(user.role) && (
                                        <>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenModal(user)}>
                                                <Pencil className="h-4 w-4" />
                                                <span className="sr-only">Editar</span>
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                <span className="sr-only">Eliminar</span>
                                            </Button>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </>
    );
}
