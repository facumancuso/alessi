'use client';
import { useTransition, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, DatabaseZap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { seedDatabase } from '@/lib/seed';
import Link from 'next/link';
import type { User } from '@/lib/types';
import { createUser } from '@/lib/auth-actions';

const defaultUsers: Omit<User, 'id'>[] = [
    { name: 'Admin', email: 'admin@alessi.com', password: 'okalessi', role: 'Superadmin', isActive: true },
    { name: 'Matias', email: 'gerente@alessi.com', password: 'Matias22', role: 'Gerente', isActive: true },
    { name: 'Sabrina', email: 'recepcion@alessi.com', password: 'Sabrina1', role: 'Recepcion', isActive: true },
    { name: 'Miguel Alessi', email: 'miguel.alessi@alessi.com', password: 'Miguelok', role: 'Peluquero', isActive: true },
    { name: 'Viviana', email: 'viviana@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Ines', email: 'ines@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Yamila', email: 'yamila@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Noelia', email: 'noelia@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Gonzalo', email: 'gonzalo@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Federico', email: 'federico@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
];


export default function SeedPage() {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleSeedDatabase = () => {
        startTransition(async () => {
            let userErrors = 0;
            toast({ title: "Iniciando proceso...", description: "Creando usuarios..." });

            for (const user of defaultUsers) {
                try {
                    await createUser(user);
                    toast({ title: "Usuario Creado", description: `Usuario ${user.email} creado con éxito.` });
                } catch (error: any) {
                    console.error(`Failed to create user ${user.email}:`, error);
                    toast({ variant: 'destructive', title: "Error al crear usuario", description: `No se pudo crear ${user.email}: ${error.message}` });
                    userErrors++;
                }
            }

            toast({ title: "Creando servicios y productos..." });

            try {
                const result = await seedDatabase();
                toast({
                    title: "Datos Inicializados",
                    description: `${result.message}. Errores de usuario: ${userErrors}.`,
                });
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Error al inicializar",
                    description: error.message || "No se pudo completar la operación de datos. Revisa la consola.",
                });
                console.error("Seeding data failed:", error);
            }
        });
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-secondary/50">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>Inicializar Base de Datos (Seed)</CardTitle>
                    <CardDescription>
                        Este proceso creará los usuarios, servicios y productos por defecto en la base de datos de Firebase.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>¡Acción Peligrosa!</AlertTitle>
                        <AlertDescription>
                            Ejecuta este script solo una vez en una base de datos vacía. Si ya existen usuarios con los mismos correos electrónicos, el proceso fallará para esos usuarios.
                        </AlertDescription>
                    </Alert>
                    <div className="flex flex-col gap-2">
                        <Button onClick={handleSeedDatabase} disabled={isPending} className="w-full">
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                            Inicializar Base de Datos
                        </Button>
                         <Button variant="outline" asChild>
                            <Link href="/login">Ir a Login</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
