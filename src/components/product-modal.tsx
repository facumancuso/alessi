'use client';
import { useEffect, useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createProduct, updateProduct } from '@/lib/data';
import type { Product } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export function ProductModal({ isOpen, onClose, product }: ProductModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [cashPrice, setCashPrice] = useState(0);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (product) {
      setCode(product.code || '');
      setName(product.name || '');
      setPrice((product.price || 0) / 100);
      setCashPrice(product.cashPrice ? product.cashPrice / 100 : 0);
    } else {
      setCode('');
      setName('');
      setPrice(0);
      setCashPrice(0);
    }
  }, [product]);

  const handleSave = () => {
    startTransition(async () => {
        const productData = {
            code,
            name,
            price: Math.round(price * 100),
            cashPrice: cashPrice > 0 ? Math.round(cashPrice * 100) : undefined,
        };

        try {
            if (product) {
                await updateProduct(product.id, productData);
                toast({ title: "Producto actualizado", description: "El producto se ha guardado correctamente." });
            } else {
                await createProduct(productData);
                toast({ title: "Producto creado", description: "El nuevo producto se ha añadido a la lista." });
            }
            onClose();
        } catch(error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el producto." });
        }
    });
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          <DialogDescription>
            Completá los datos del producto y guardá los cambios.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código del producto</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del producto</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Precio Tarjeta</Label>
              <Input id="price" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cashPrice">Precio Efectivo</Label>
              <Input id="cashPrice" type="number" value={cashPrice} onChange={(e) => setCashPrice(Number(e.target.value))} />
            </div>
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
