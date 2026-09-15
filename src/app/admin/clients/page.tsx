
'use client';
import Link from 'next/link';
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
    CardFooter,
  } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { ArrowUpRight, PlusCircle, Pencil, Trash2, Upload, Download, Search, Loader2, ArrowUpDown } from "lucide-react";
import { getClientsPaginated, type ClientListItem, type ClientSortKey } from '@/lib/data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect, useTransition, useRef } from 'react';
import dynamic from 'next/dynamic';
const ClientModal = dynamic(() => import('@/components/client-modal').then(m => m.ClientModal), { ssr: false, loading: () => null });
import type { Client } from '@/lib/types';
import { WhatsAppReminderButton } from '@/components/whatsapp-reminder-button';
import { useCurrentUser } from '../user-context';
import { exportClients, deleteClientAction, importClientsFromCsv } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ClientWithAppointments = ClientListItem;
type SortableKeys = ClientSortKey;


const ITEMS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 350;


export default function ClientsPage() {
    const router = useRouter();
    const { currentUser } = useCurrentUser();
    const { toast } = useToast();
    const [clients, setClients] = useState<ClientWithAppointments[]>([]);
    const [totalClients, setTotalClients] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Partial<Client> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isProcessing, startTransition] = useTransition();
    const [isImporting, setIsImporting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
    const importInputRef = useRef<HTMLInputElement>(null);

    const canManage = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente' || currentUser?.role === 'Recepcion';
    const canImportExport = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente';
    const canViewClients = currentUser?.role === 'Superadmin' || currentUser?.role === 'Gerente' || currentUser?.role === 'Recepcion';

    // Debounce the search box so we don't fire a request on every keystroke.
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearchTerm(searchTerm), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [searchTerm]);

    // Reset to page 1 whenever the search or sort criteria change.
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, sortConfig]);

    const fetchClientsPage = async () => {
        const result = await getClientsPaginated({
            page: currentPage,
            pageSize: ITEMS_PER_PAGE,
            search: debouncedSearchTerm,
            sortKey: sortConfig.key,
            sortDirection: sortConfig.direction,
        });
        setClients(result.clients);
        setTotalClients(result.total);
    };

    useEffect(() => {
        if (!currentUser) return; // wait for context to populate
        if (!canViewClients) {
          router.push('/admin');
          return;
        }
        startTransition(async () => {
            await fetchClientsPage();
        });
    }, [currentUser, canViewClients, currentPage, debouncedSearchTerm, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(totalClients / ITEMS_PER_PAGE));
    const paginatedClients = clients;

    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1); // Reset to first page on sort
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
        }
        if (sortConfig.direction === 'descending') {
            return <ArrowUpDown className="ml-2 h-4 w-4 transform rotate-180" />;
        }
        return <ArrowUpDown className="ml-2 h-4 w-4" />;
    };


    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };


    const handleOpenModal = (client: Partial<Client> | null) => {
        if (!canManage) return;
        setSelectedClient(client);
        setIsModalOpen(true);
    }
    
    const handleCloseModal = () => {
        setSelectedClient(null);
        setIsModalOpen(false);
        startTransition(async () => {
            await fetchClientsPage();
        });
    }

    const handleDelete = async (id: string, name: string) => {
        if (!canManage) {
            toast({
                variant: 'destructive',
                title: 'Sin permisos',
                description: 'No tienes permisos para eliminar clientes',
            });
            return;
        }

        const confirmed = window.confirm(
            `¿Estás seguro de que quieres eliminar a "${name}"?\n\nEsta acción no se puede deshacer.`
        );

        if (!confirmed) return;

        startTransition(async () => {
            try {
                const result = await deleteClientAction(id);

                if (result.success) {
                    toast({
                        title: 'Cliente eliminado',
                        description: `${name} ha sido eliminado correctamente`
                    });
                    await fetchClientsPage();
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: result.message
                    });
                }
            } catch (error: any) {
                toast({
                    variant: 'destructive',
                    title: 'Error inesperado',
                    description: 'No se pudo eliminar el cliente. Intenta de nuevo.'
                });
            }
        });
    }
    
    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        
        toast({
            title: '🔄 Importando clientes...',
            description: `Procesando archivo: ${file.name}`,
        });

        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const result = await importClientsFromCsv(formData);
            
            if (result.success) {
                toast({
                    title: '✅ Importación Exitosa',
                    description: `${result.createdCount || 0} clientes creados, ${result.updatedCount || 0} actualizados`,
                });
                
                await fetchClientsPage();
            } else {
                toast({
                    variant: 'destructive',
                    title: '❌ Error en la importación',
                    description: result.message,
                });
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: '❌ Error inesperado',
                description: error.message || 'Ocurrió un error al importar el archivo',
            });
        } finally {
            setIsImporting(false);
            if (importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    };


    const handleExport = () => {
        startTransition(async () => {
            try {
                const csvData = await exportClients();
                const blob = new Blob(["\uFEFF" + csvData], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'clientes.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'Exportación completa', description: 'Los datos de los clientes se han descargado.' });
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error de exportación', description: 'No se pudieron exportar los datos.' });
            }
        });
    };

    const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, client: ClientWithAppointments) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a')) {
            return;
        }
        router.push(`/admin/clients/${encodeURIComponent(client.email!)}`);
    }

    return (
        <>
            <ClientModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                client={selectedClient}
            />
            <input 
                type="file" 
                ref={importInputRef} 
                className="hidden" 
                onChange={handleFileImport} 
                accept=".csv" 
            />
            <Card>
                <CardHeader className="space-y-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <CardTitle>Gestión de Clientes</CardTitle>
                                <Badge variant="secondary">{totalClients} Clientes</Badge>
                                {isImporting && (
                                    <Badge variant="outline" className="animate-pulse">
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        Importando...
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>
                                Aquí puedes ver el listado de clientes. Haz clic para ver detalles.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {canImportExport && (
                                <>
                                    <Button 
                                        variant="outline" 
                                        onClick={handleImportClick} 
                                        disabled={isProcessing || isImporting}
                                    >
                                        {isImporting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Importando...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Importar CSV
                                            </>
                                        )}
                                    </Button>
                                    <Button variant="outline" onClick={handleExport} disabled={isProcessing || isImporting}>
                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                        Exportar
                                    </Button>
                                </>
                           )}
                           {canManage && (
                               <Button onClick={() => handleOpenModal(null)} disabled={isImporting}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Añadir Cliente
                                </Button>
                           )}
                        </div>
                    </div>
                     <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por código, nombre, email o teléfono..." 
                            className="pl-8 w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={isImporting}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => requestSort('code')} className="px-0">
                                        Código {getSortIndicator('code')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => requestSort('name')} className="px-0">
                                        Nombre {getSortIndicator('name')}
                                    </Button>
                                </TableHead>
                                <TableHead>Contacto</TableHead>
                                <TableHead>
                                    <Button variant="ghost" onClick={() => requestSort('totalAppointments')} className="px-0">
                                        Turnos Totales {getSortIndicator('totalAppointments')}
                                    </Button>
                                </TableHead>
                                <TableHead>
                                     <Button variant="ghost" onClick={() => requestSort('lastVisit')} className="px-0">
                                        Última Visita {getSortIndicator('lastVisit')}
                                    </Button>
                                </TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isProcessing && paginatedClients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : paginatedClients.map((client) => (
                                <TableRow key={client.id} onClick={(e) => handleRowClick(e, client)} className="cursor-pointer">
                                    <TableCell className="font-mono">{client.code}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{client.name}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-muted-foreground">{client.email}</div>
                                        <div className="text-sm text-muted-foreground">{client.mobilePhone}</div>
                                    </TableCell>
                                    <TableCell>
                                        {client.totalAppointments}
                                    </TableCell>
                                    <TableCell>
                                        {client.lastVisit && new Date(client.lastVisit).getFullYear() > 1970 ? format(new Date(client.lastVisit), "PPP", { locale: es }) : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right space-x-1">
                                        <WhatsAppReminderButton 
                                            appointments={client.allAppointments}
                                            clientName={client.name}
                                            clientPhone={client.mobilePhone}
                                            variant="icon"
                                        />
                                         {canManage && (
                                            <>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        handleOpenModal(client);
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    <span className="sr-only">Editar</span>
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(client.id, client.name || 'Cliente');
                                                    }}
                                                    disabled={isProcessing}
                                                >
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
                {totalPages > 1 && (
                    <CardFooter className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                            Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1 || isImporting}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages || isImporting}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </>
    );
}
