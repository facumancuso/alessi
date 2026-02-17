
'use client';
import { useEffect, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createClient, updateClient } from '@/lib/data';
import type { Client } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from './ui/scroll-area';
import { Switch } from './ui/switch';


interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Partial<Client> | null;
}

export function ClientModal({ isOpen, onClose, client }: ClientModalProps) {
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (client) {
      setFormData({
        ...client,
        code: client.code || '',
        name: client.name || '',
        email: client.email || '',
        mobilePhone: client.mobilePhone || '',
        address: client.address || '',
        alias: client.alias || '',
        location: client.location || '',
        postalCode: client.postalCode || '',
        landlinePhone: client.landlinePhone || '',
        dni: client.dni || '',
        cuit: client.cuit || '',
        priceList: client.priceList || '',
        fantasyName: client.fantasyName || '',
        salespersonId: client.salespersonId || '',
        salespersonName: client.salespersonName || '',
        clientCategory: client.clientCategory || '',
        inactive: client.inactive || false,
      });
    } else {
      // For new clients, initialize with empty strings and default values
      setFormData({
        code: undefined, // Let the backend generate it
        name: '',
        email: '',
        mobilePhone: '',
        address: '',
        alias: '',
        location: '',
        postalCode: '',
        landlinePhone: '',
        dni: '',
        cuit: '',
        priceList: '',
        fantasyName: '',
        salespersonId: '',
        salespersonName: '',
        clientCategory: '',
        inactive: false,
      });
    }
  }, [client]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

   const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, inactive: checked }));
  };

  const handleSave = () => {
    startTransition(async () => {
        try {
        // Build a clean payload with only client fields that belong in Firestore
        const payload: Partial<Client> = {
          code: formData.code as string | undefined,
          name: formData.name as string | undefined,
          email: formData.email as string | undefined,
          mobilePhone: formData.mobilePhone as string | undefined,
          address: formData.address as string | undefined,
          alias: formData.alias as string | undefined,
          location: formData.location as string | undefined,
          postalCode: formData.postalCode as string | undefined,
          landlinePhone: formData.landlinePhone as string | undefined,
          dni: formData.dni as string | undefined,
          cuit: formData.cuit as string | undefined,
          priceList: formData.priceList as string | undefined,
          fantasyName: formData.fantasyName as string | undefined,
          salespersonId: formData.salespersonId as string | undefined,
          salespersonName: formData.salespersonName as string | undefined,
          clientCategory: formData.clientCategory as string | undefined,
          inactive: formData.inactive as boolean | undefined,
        };

        // Remove undefined values so updateDoc doesn't receive invalid fields
        const cleanedPayload: Partial<Client> = {};
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined) (cleanedPayload as any)[k] = v;
        });

        if (client && (client as any).id) {
          await updateClient((client as any).id, cleanedPayload);
          toast({ title: "Cliente actualizado", description: "El cliente se ha guardado correctamente." });
        } else {
          await createClient(cleanedPayload);
          toast({ title: "Cliente creado", description: "El nuevo cliente se ha añadido a la lista." });
        }
            onClose();
        } catch(error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el cliente." });
        }
    });
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{client ? `Editar Cliente: ${client.name}` : 'Nuevo Cliente'}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="main">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="main">Datos Principales</TabsTrigger>
            <TabsTrigger value="additional">Datos Adicionales</TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[60vh] p-1">
            <TabsContent value="main" className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" value={formData.name || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alias">Alias</Label>
                  <Input id="alias" value={formData.alias || ''} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fantasyName">Nombre de Fantasía</Label>
                  <Input id="fantasyName" value={formData.fantasyName || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobilePhone">Teléfono Celular</Label>
                  <Input id="mobilePhone" value={formData.mobilePhone || ''} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="landlinePhone">Teléfono Fijo</Label>
                  <Input id="landlinePhone" value={formData.landlinePhone || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Domicilio</Label>
                  <Input id="address" value={formData.address || ''} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="location">Localidad</Label>
                  <Input id="location" value={formData.location || ''} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="postalCode">Código Postal</Label>
                  <Input id="postalCode" value={formData.postalCode || ''} onChange={handleInputChange} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="additional" className="p-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI</Label>
                  <Input id="dni" value={formData.dni || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuit">CUIT</Label>
                  <Input id="cuit" value={formData.cuit || ''} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="priceList">Lista de Precios</Label>
                  <Input id="priceList" value={formData.priceList || ''} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientCategory">Categoría de Cliente</Label>
                  <Input id="clientCategory" value={formData.clientCategory || ''} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="salespersonId">ID Vendedor</Label>
                  <Input id="salespersonId" value={formData.salespersonId || ''} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="salespersonName">Nombre Vendedor</Label>
                  <Input id="salespersonName" value={formData.salespersonName || ''} onChange={handleInputChange} />
                </div>
                <div className="flex items-center space-x-2 md:col-span-2 pt-4">
                    <Switch id="inactive" checked={formData.inactive} onCheckedChange={handleSwitchChange} />
                    <Label htmlFor="inactive">Cliente Inactivo</Label>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
