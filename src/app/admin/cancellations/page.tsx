
'use client';
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
import { getAppointments } from "@/lib/data";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useEffect, useState } from "react";
import type { Appointment } from "@/lib/types";
import { Button } from "@/components/ui/button";

const ITEMS_PER_PAGE = 10;

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        {...props}
    >
        <path d="M16.75 13.96c.25.13.41.2.5.33.1.13.15.42.06.66-.09.24-.5.75-1.03 1.25-.53.5-1.12.78-1.57.88-.45.1-1.04.09-1.68-.16-1.57-.6-2.83-1.44-3.93-2.63-1.1-1.19-1.88-2.52-2.5-4.04-.17-.4-.25-.8-.25-1.19s.09-.73.25-1.02c.16-.29.4-.51.7-.66.3-.15.63-.22.96-.22.32 0 .63.07.9.22.27.15.41.33.53.53.12.2.14.44.1.68-.04.24-.13.55-.26.83-.13.28-.26.5-.39.66-.13.16-.25.3-.3.4s-.04.2.04.35c.08.15.26.46.5.75.24.29.5.58.83.85.33.27.6.48.84.64.24.16.4.25.5.3.1.05.18.06.27.01.09-.05.35-.19.68-.38.33-.19.63-.29.86-.29.23 0 .52.09.73.28m-4.66 6.45c2.03 0 3.96-.67 5.61-1.9L19.5 20l-1.45-1.75c1.1-1.58 1.75-3.43 1.75-5.45 0-4.78-3.87-8.65-8.65-8.65S.5 3.02.5 7.8c0 2.6.94 4.95 2.63 6.78L2 19.5l4.89-1.25c1.52.88 3.24 1.39 5.02 1.39h.01z" />
    </svg>
);

export default function CancellationsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        getAppointments('cancelled').then(data => {
            const sorted = data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setAppointments(sorted);
        });
    }, []);

    const totalPages = Math.ceil(appointments.length / ITEMS_PER_PAGE);
    const paginatedAppointments = appointments.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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

    const createWhatsAppLink = (phone: string, name: string) => {
        const message = `Hola ${name}, vimos que cancelaste tu turno. ¿Te gustaría reprogramarlo? Estamos a tu disposición para encontrar un nuevo horario.`;
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Turnos Cancelados</CardTitle>
                <CardDescription>Aquí puedes ver todos los turnos que han sido cancelados. Puedes contactar al cliente para reprogramar.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Fecha Original</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedAppointments.map((appt) => (
                            <TableRow key={appt.id}>
                                <TableCell>
                                    <div className="font-medium">{appt.customerName}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {appt.customerEmail}
                                    </div>
                                </TableCell>
                                <TableCell>{(Array.isArray(appt.serviceNames) ? appt.serviceNames.join(', ') : appt.serviceNames)}</TableCell>
                                <TableCell>
                                    {format(new Date(appt.date), "PPP p", { locale: es })}
                                </TableCell>
                                <TableCell className="text-right">
                                    {appt.customerPhone ? (
                                        <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#128C7E]">
                                            <a href={createWhatsAppLink(appt.customerPhone, appt.customerName)} target="_blank" rel="noopener noreferrer">
                                                <WhatsAppIcon className="h-4 w-4 mr-2" />
                                                Contactar
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button asChild variant="outline" size="sm">
                                            <a href={`mailto:${appt.customerEmail}?subject=Reprogramar turno en Alessi Hairdressing`}>Contactar</a>
                                        </Button>
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
                            disabled={currentPage === 1}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente
                        </Button>
                    </div>
                </CardFooter>
            )}
        </Card>
    );
}

    
