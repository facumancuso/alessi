
'use client';
import { useRef, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createBackup, restoreBackup } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Download, Loader2, AlertTriangle, Upload, FileJson } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

export default function BackupPage() {
    const [isPending, startTransition] = useTransition();
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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
                    description: "El archivo de backup completo se ha descargado correctamente.",
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setSelectedFileName(file?.name || null);
    };

    const handleRestoreBackup = () => {
        if (!fileInputRef.current?.files?.length) {
            toast({
                variant: 'destructive',
                title: 'Archivo requerido',
                description: 'Selecciona un archivo de backup .json para restaurar.',
            });
            return;
        }

        if (!window.confirm('Esta accion reemplazara todos los datos actuales. ¿Querés continuar?')) {
            return;
        }

        const file = fileInputRef.current.files[0];
        const formData = new FormData();
        formData.append('file', file);

        startTransition(async () => {
            const result = await restoreBackup(formData);
            if (result.success) {
                toast({ title: 'Restauracion completa', description: result.message });
                return;
            }

            toast({ variant: 'destructive', title: 'Error al restaurar', description: result.message });
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Backup Completo</CardTitle>
                    <CardDescription>
                        Genera y restaura un archivo JSON completo con datos críticos: turnos, clientes, productos, servicios, usuarios y configuración.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Importante</AlertTitle>
                        <AlertDescription>
                            El backup contiene datos sensibles (usuarios y configuración). Guardalo en un lugar seguro. La restauración reemplaza todos los datos actuales.
                        </AlertDescription>
                    </Alert>

                    <div className="flex flex-wrap gap-2">
                        <Button onClick={handleCreateBackup} disabled={isPending} className="w-full md:w-auto">
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Descargar Backup Completo
                        </Button>
                    </div>

                    <div className="space-y-2 rounded-lg border p-4">
                        <Label htmlFor="restore-file">Restaurar desde backup</Label>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isPending}>
                                <Upload className="mr-2 h-4 w-4" />
                                Seleccionar Archivo
                            </Button>
                            {selectedFileName && (
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <FileJson className="h-4 w-4" />
                                    {selectedFileName}
                                </span>
                            )}
                            <input
                                id="restore-file"
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        <Button variant="destructive" onClick={handleRestoreBackup} disabled={isPending || !selectedFileName} className="w-full md:w-auto">
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Restaurar Backup Completo
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
