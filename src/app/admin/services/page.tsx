
'use client'
import { useState, useEffect, useMemo, useTransition, useRef } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Pencil, Trash2, Upload, Download, Search, Loader2 } from "lucide-react";
import { getServices, deleteService } from '@/lib/data';
import type { Service } from '@/lib/types';
import { ServiceModal } from "@/components/service-modal";
import { useCurrentUser } from "../user-context";
import { exportServices, importData } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";


export default function ServicesPage() {
    const { currentUser } = useCurrentUser();
    const { toast } = useToast();
    const [services, setServices] = useState<Service[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isProcessing, startTransition] = useTransition();

    const importInputRef = useRef<HTMLInputElement>(null);

    const canManage = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente' || currentUser?.role === 'Recepcion';
    const canImportExport = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente';

    const fetchServices = () => getServices().then(setServices);

    useEffect(() => {
        fetchServices();
    }, []);

    const filteredServices = useMemo(() => {
        return services.filter(service => 
            service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            service.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [services, searchTerm]);

    const handleOpenModal = (service: Service | null) => {
        if (!canManage) return;
        setSelectedService(service);
        setIsModalOpen(true);
    }
    
    const handleCloseModal = () => {
        setSelectedService(null);
        setIsModalOpen(false);
        fetchServices();
    }

    const handleDelete = async (id: string) => {
        if (!canManage) return;
        if (confirm("¿Estás seguro de que quieres eliminar este servicio?")) {
            await deleteService(id);
            fetchServices();
        }
    }

    const handleExport = () => {
        startTransition(async () => {
            try {
                const csvData = await exportServices();
                const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'servicios.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'Exportación completa', description: 'Los datos de los servicios se han descargado.' });
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error de exportación', description: 'No se pudieron exportar los datos.' });
            }
        });
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        startTransition(async () => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'services');
            const result = await importData(formData);
            if (result.success) {
                toast({ title: 'Importación completa', description: result.message });
                fetchServices();
            } else {
                toast({ variant: 'destructive', title: 'Error de importación', description: result.message });
            }
        });
        if(importInputRef.current) importInputRef.current.value = "";
    };


    return (
        <>
        <ServiceModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            service={selectedService}
        />
        <input type="file" ref={importInputRef} className="hidden" onChange={handleFileImport} accept=".csv" />
        <Card>
            <CardHeader className="space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Gestión de Servicios</CardTitle>
                        <CardDescription>
                            Aquí puedes ver {canManage ? ', añadir, editar y eliminar' : ''} los servicios de tu negocio.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {canImportExport && (
                            <>
                                <Button variant="outline" onClick={handleImportClick} disabled={isProcessing}>
                                   {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                                   Importar
                               </Button>
                               <Button variant="outline" onClick={handleExport} disabled={isProcessing}>
                                   {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                   Exportar
                               </Button>
                            </>
                        )}
                        {canManage && (
                           <Button onClick={() => handleOpenModal(null)}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Añadir Servicio
                            </Button>
                        )}
                    </div>
                </div>
                 <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por código o nombre..." 
                        className="pl-8 w-full md:w-1/2 lg:w-1/3"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Duración (min)</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            {canManage && <TableHead className="text-right">Acciones</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredServices.map((service) => (
                            <TableRow key={service.id}>
                                <TableCell className="font-mono">{service.code}</TableCell>
                                <TableCell>
                                    <div className="font-medium">{service.name}</div>
                                </TableCell>
                                <TableCell>{service.duration}</TableCell>
                                <TableCell className="text-right">
                                    ${(service.price / 100).toFixed(2)}
                                </TableCell>
                                {canManage && (
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(service)}>
                                        <Pencil className="h-4 w-4" />
                                        <span className="sr-only">Editar</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        <span className="sr-only">Eliminar</span>
                                    </Button>
                                </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        </>
    );
}
