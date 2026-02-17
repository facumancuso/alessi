
'use client';
import { Button } from "@/components/ui/button";
import type { Appointment } from "@/lib/types";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        {...props}
    >
        <path d="M16.75 13.96c.25.13.41.2.5.33.1.13.15.42.06.66-.09.24-.5.75-1.03 1.25-.53.5-1.12.78-1.57.88-.45.1-1.04.09-1.68-.16-1.57-.6-2.83-1.44-3.93-2.63-1.1-1.19-1.88-2.52-2.5-4.04-.17-.4-.25-.8-.25-1.19s.09-.73.25-1.02c.16-.29.4-.51.7-.66.3-.15.63-.22.96-.22.32 0 .63.07.9.22.27.15.41.33.53.53.12.2.14.44.1.68-.04.24-.13.55-.26.83-.13.28-.26.5-.39.66-.13.16-.25.3-.3.4s-.04.2.04.35c.08.15.26.46.5.75.24.29.5.58.83.85.33.27.6.48.84.64.24.16.4.25.5.3.1.05.18.06.27.01.09-.05.35-.19.68-.38.33-.19.63-.29.86-.29.23 0 .52.09.73.28m-4.66 6.45c2.03 0 3.96-.67 5.61-1.9L19.5 20l-1.45-1.75c1.1-1.58 1.75-3.43 1.75-5.45 0-4.78-3.87-8.65-8.65-8.65S.5 3.02.5 7.8c0 2.6.94 4.95 2.63 6.78L2 19.5l4.89-1.25c1.52.88 3.24 1.39 5.02 1.39h.01z" />
    </svg>
);

interface WhatsAppDashboardButtonProps {
    appointment: Appointment;
}

export function WhatsAppDashboardButton({ appointment }: WhatsAppDashboardButtonProps) {
    if (!appointment.customerPhone) {
        return (
             <Button variant="outline" size="sm" disabled>
                <WhatsAppIcon className="w-4 h-4 mr-2" />
                Recordar
            </Button>
        );
    }
    
    const appointmentDate = new Date(appointment.date);
    const date = format(appointmentDate, "eeee dd 'de' MMMM", { locale: es });
    const time = format(appointmentDate, "HH:mm", { locale: es });
    const message = `¡Hola ${appointment.customerName.toUpperCase()}! Te recordamos tu turno en Alessi Hairdressing, día ${date}, a las ${time} hs. Recuerda que el tiempo de tolerancia es de 10 minutos. ¡Te esperamos!`;
    const whatsAppLink = `https://web.whatsapp.com/send?phone=${appointment.customerPhone}&text=${encodeURIComponent(message)}`;

    return (
        <Button asChild size="sm" className="bg-[#25D366] text-white hover:bg-[#128C7E]">
            <a href={whatsAppLink} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="h-4 w-4 mr-2" />
                Recordar
            </a>
        </Button>
    );
}
