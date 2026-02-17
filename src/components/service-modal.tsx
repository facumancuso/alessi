'use client';
import { useEffect, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createService, updateService } from '@/lib/data';
import type { Service } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service | null;
}

export function ServiceModal({ isOpen, onClose, service }: ServiceModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (service) {
      setCode(service.code || '');
      setName(service.name || '');
      setDuration(service.duration || 30);
      setPrice((service.price || 0) / 100);
    } else {
      setCode('');
      setName('');
      setDuration(30);
      setPrice(0);
    }
  }, [service]);

  const handleSave = () => {
    startTransition(async () => {
        const serviceData = {
            code,
            name,
            duration,
            price: Math.round(price * 100),
        };

        try {
            if (service) {
                await updateService(service.id, serviceData);
                toast({ title: "Servicio actualizado", description: "El servicio se ha guardado correctamente." });
            } else {
                await createService(serviceData);
                toast({ title: "Servicio creado", description: "El nuevo servicio se ha añadido a la lista." });
            }
            onClose();
        } catch(error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el servicio." });
        }
    });
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código del servicio</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del servicio</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duración (en minutos)</Label>
            <Input id="duration" type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Precio</Label>
            <Input id="price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
        </div>
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
