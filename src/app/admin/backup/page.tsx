
'use client';
import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createBackup } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function BackupPage() {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleCreateBackup = () => {
        startTransition(async () => {
            try {
                const backupData = await createBackup();

                const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
                link.download = `alessi_backup_${timestamp}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                toast({
                    title: "Backup Generado",
                    description: "El archivo de respaldo se ha descargado correctamente.",
                });

            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error al generar el backup",
                    description: "No se pudo completar la operación. Inténtalo de nuevo.",
                });
                console.error("Backup failed:", error);
            }
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Copia de Seguridad de Datos</CardTitle>
                    <CardDescription>
                        Genera y descarga un archivo JSON con todos los datos importantes de la aplicación, incluyendo turnos, clientes, productos, servicios y usuarios.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Importante</AlertTitle>
                        <AlertDescription>
                            Guardar este archivo en un lugar seguro. Contiene toda la información de tu negocio. Esta función no permite restaurar los datos automáticamente.
                        </AlertDescription>
                    </Alert>
                    <Button onClick={handleCreateBackup} disabled={isPending} className="w-full md:w-auto">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Generar y Descargar Backup
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
