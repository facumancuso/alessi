'use client';
import { useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { deleteAllProducts, deleteAllServices, deleteAllClients } from '@/lib/data';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function CleanupPage() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleCleanup = (type: 'services' | 'products' | 'clients') => {
    startTransition(async () => {
      try {
        let result;
        if (type === 'services') {
          result = await deleteAllServices();
        } else if (type === 'products') {
          result = await deleteAllProducts();
        } else {
          result = await deleteAllClients();
        }

        toast({
          title: `Limpieza Completada`,
          description: `Se eliminaron ${result.deletedCount} ${type}.`,
        });
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: `Error en la limpieza de ${type}`,
          description:
            error.message ||
            'No se pudo completar la operación. Inténtalo de nuevo.',
        });
        console.error(`Cleanup failed for ${type}:`, error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Limpieza de Datos Maestros</CardTitle>
          <CardDescription>
            Elimina todos los servicios, productos o clientes de la base de datos. Esta
            acción es útil para preparar el sistema antes de cargar nuevos datos
            maestros a través del proceso de importación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>¡Acción Permanente!</AlertTitle>
            <AlertDescription>
              Esta acción eliminará todos los registros de forma definitiva y no
              se puede deshacer. Úsala con precaución.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Servicios</CardTitle>
                <CardDescription>
                  Eliminar todos los servicios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Servicios
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Estás absolutamente seguro?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción es permanente y eliminará todos los
                        servicios. No podrás recuperarlos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => handleCleanup('services')}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Sí, eliminar todo'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Productos</CardTitle>
                <CardDescription>
                  Eliminar todos los productos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Productos
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Estás absolutamente seguro?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción es permanente y eliminará todos los
                        productos. No podrás recuperarlos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => handleCleanup('products')}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Sí, eliminar todo'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clientes</CardTitle>
                <CardDescription>
                  Eliminar todos los clientes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Clientes
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Estás absolutamente seguro?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción es permanente y eliminará todos los
                        clientes. No podrás recuperarlos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => handleCleanup('clients')}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Sí, eliminar todo'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
