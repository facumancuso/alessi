'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/icons';
import { useState, useContext } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth-actions';
import { useCurrentUser } from '../admin/user-context';

export default function LoginForm({ users, dbError = false }: { users: User[]; dbError?: boolean }) {
    const router = useRouter();
    const { setCurrentUser } = useCurrentUser();
    const { toast } = useToast();
    
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPending(true);

        try {
            const user = await signIn(email, password);
            if (user) {
                setCurrentUser(user);
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                if (user.role === 'Peluquero') {
                    router.push('/admin/my-day');
                } else {
                    router.push('/admin');
                }
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Error de inicio de sesión',
                    description: 'Usuario o contraseña incorrectos.',
                });
            }
        } catch (error: any) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error de inicio de sesión',
                description: 'Ocurrió un error inesperado.',
            });
        } finally {
            setIsPending(false);
        }
    };


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/50 p-4">
            <div className="absolute top-4 left-4">
                <Button variant="ghost" asChild>
                    <Link href="/" className="flex items-center justify-center gap-2">
                        <Logo className="h-6 w-6 text-primary" />
                        <span className="text-xl font-headline font-bold text-primary">Alessi Hairdressing</span>
                    </Link>
                </Button>
            </div>
        
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl font-headline">Iniciar Sesión</CardTitle>
                    <CardDescription>
                        Ingresa tus credenciales para acceder al panel.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {dbError && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>
                                No se pudo conectar a la base de datos. Revisa MongoDB Atlas (Network Access/IP whitelist) y vuelve a intentar.
                            </AlertDescription>
                        </Alert>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Usuario (Email)</Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between font-normal"
                                    >
                                        {email ? (
                                            users.find((user) => user.email === email)?.name
                                        ) : (
                                            "Seleccionar usuario..."
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar usuario..." />
                                        <CommandList>
                                            <CommandEmpty>Usuario no encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {(users || []).map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={user.email}
                                                        onSelect={(currentValue) => {
                                                            setEmail(currentValue === email ? "" : currentValue)
                                                            setOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                email === user.email ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {user.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <input type="hidden" name="email" value={email} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input 
                                id="password" 
                                name="password"
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        
                        <Button type="submit" className="w-full" disabled={isPending || !email || !password}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ingresar
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
