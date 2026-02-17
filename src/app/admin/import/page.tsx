
'use client';
import { useState, useTransition, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Upload, FileJson, Users, Package, Scissors, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { importFromJson } from '@/lib/actions';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

export default function ImportPage() {
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
    } else {
      setFileName(null);
    }
  };
  
  const handleImport = (type: 'clients' | 'services' | 'products' | 'users') => {
    if (!fileInputRef.current?.files?.length) {
        toast({
            variant: "destructive",
            title: "Ningún archivo seleccionado",
            description: "Por favor, selecciona primero el archivo de backup JSON.",
        });
        return;
    }
    
    const file = fileInputRef.current.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    startTransition(async () => {
        try {
            const result = await importFromJson(formData);
            if (result.success) {
                toast({
                    title: `Importación de ${type} completada`,
                    description: result.message,
                });
            } else {
                 toast({
                    variant: "destructive",
                    title: `Error en la importación de ${type}`,
                    description: result.message,
                });
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error inesperado",
                description: `No se pudo completar la importación: ${error.message}`,
            });
        }
    });
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary/50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Volver</span>
                    </Link>
                </Button>
                <CardTitle>Importar Datos desde Backup</CardTitle>
          </div>
          <CardDescription>
            Restaura los datos de tu aplicación desde un archivo de respaldo JSON.
            Esta acción reemplazará los datos existentes en la colección correspondiente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>¡Acción Destructiva!</AlertTitle>
            <AlertDescription>
              Importar datos **eliminará permanentemente** todos los registros existentes
              en la colección que elijas (Clientes, Servicios o Productos) y los
              reemplazará con los datos del archivo. Los usuarios no se eliminan, solo se añaden los nuevos.
              Úsalo con precaución, especialmente en producción.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="backup-file">1. Selecciona el archivo de Backup (.json)</Label>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isPending}>
                    <Upload className="mr-2 h-4 w-4" />
                    Seleccionar Archivo
                </Button>
                {fileName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileJson className="h-4 w-4"/>
                        <span>{fileName}</span>
                    </div>
                )}
            </div>
            <input 
                id="backup-file"
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".json"
                onChange={handleFileChange}
            />
          </div>

          <div className="space-y-4">
             <Label>2. Elige qué datos importar</Label>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={() => handleImport('clients')} disabled={isPending || !fileName} variant="secondary" className="justify-start gap-2 h-12">
                    {isPending ? <Loader2 className="animate-spin" /> : <Users />}
                    Importar Clientes
                </Button>
                <Button onClick={() => handleImport('services')} disabled={isPending || !fileName} variant="secondary" className="justify-start gap-2 h-12">
                    {isPending ? <Loader2 className="animate-spin" /> : <Scissors />}
                    Importar Servicios
                </Button>
                <Button onClick={() => handleImport('products')} disabled={isPending || !fileName} variant="secondary" className="justify-start gap-2 h-12">
                    {isPending ? <Loader2 className="animate-spin" /> : <Package />}
                    Importar Productos
                </Button>
                <Button onClick={() => handleImport('users')} disabled={isPending || !fileName} variant="secondary" className="justify-start gap-2 h-12">
                    {isPending ? <Loader2 className="animate-spin" /> : <Users />}
                    Importar Usuarios
                </Button>
             </div>
             <p className="text-xs text-muted-foreground">
                Recuerda: la importación de usuarios solo añade usuarios nuevos y no elimina los existentes.
             </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
