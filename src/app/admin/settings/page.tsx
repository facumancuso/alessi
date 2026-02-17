'use client';
import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { getSettings, updateSettings } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function SettingsPage() {
    const [spamProtection, setSpamProtection] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        getSettings().then(settings => {
            setSpamProtection(settings.spamProtection);
            setIsLoading(false);
        });
    }, []);

    const handleSpamProtectionChange = (checked: boolean) => {
        setSpamProtection(checked);
        startTransition(async () => {
            await updateSettings({ spamProtection: checked });
            toast({
                title: "Configuración guardada",
                description: `Protección contra spam ${checked ? 'activada' : 'desactivada'}.`,
            });
        });
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Protección Anti-Spam</CardTitle>
                    <CardDescription>
                        Utiliza IA para detectar y bloquear reservas falsas o maliciosas. Esta es una función Premium.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-2">
                        <Switch id="spam-protection" checked={spamProtection} onCheckedChange={handleSpamProtectionChange} disabled={isPending}/>
                        <Label htmlFor="spam-protection">
                            {spamProtection ? 'Activada' : 'Desactivada'}
                            {isPending && <Loader2 className="h-4 w-4 animate-spin ml-2 inline-block" />}
                        </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                        El sistema avanzado analiza direcciones IP, VPNs y patrones de comportamiento para asegurar que solo clientes reales puedan reservar.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Integraciones</CardTitle>
                    <CardDescription>
                        Sincroniza tu agenda con otras herramientas para optimizar tu flujo de trabajo.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.1 8.5c0-1.2-1-2.2-2.2-2.2h-1.6v-2c0-.5-.4-1-1-1s-1 .5-1 1v2h-6V6.3c0-.5-.4-1-1-1s-1 .5-1 1v2H5.1c-1.2 0-2.2 1-2.2 2.2v10.4c0 1.2 1 2.2 2.2 2.2h13.8c1.2 0 2.2-1 2.2-2.2V8.5zm-1.1 10.4c0 .6-.5 1.1-1.1 1.1H5.1c-.6 0-1.1-.5-1.1-1.1V8.5c0-.6.5-1.1 1.1-1.1h1.6v1.5c0 .5.4 1 1 1s1-.5 1-1V7.4h6v1.5c0 .5.4 1 1 1s1-.5 1-1V7.4h1.6c.6 0 1.1.5 1.1 1.1v10.4z"/><path fill="#34A853" d="M12 13.5c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5 4.5-2 4.5-4.5-2-4.5-4.5-4.5zm0 7c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"/><path fill="#FBBC05" d="M12 13.5c-2.5 0-4.5 2-4.5 4.5h9c0-2.5-2-4.5-4.5-4.5z"/><path fill="#EA4335" d="M12 18c-1.4 0-2.5-1.1-2.5-2.5S10.6 13 12 13s2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"/></svg>
                            <div>
                                <h3 className="font-semibold">Google Calendar</h3>
                                <p className="text-sm text-muted-foreground">Sincronización bidireccional de turnos.</p>
                            </div>
                        </div>
                        <Button variant="outline">Conectar</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
