'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Client } from '@/lib/types';
import { Loader2, PlusCircle } from 'lucide-react';

interface ClientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectClient: (client: Partial<Client>) => void;
}

export function ClientSearchModal({ isOpen, onClose, onSelectClient }: ClientSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Client[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setResults([]);
      setIsSearching(false);
      return;
    }

    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await fetch(`/api/clients/search?q=${encodeURIComponent(trimmed)}&limit=40`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Error buscando clientes');
        }
        const data = (await response.json()) as Client[];
        setResults(data);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error en búsqueda de clientes:', error);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 280);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchTerm, isOpen]);

  const handleCreateNew = () => {
    const name = searchTerm.trim();
    if (!name) return;
    onSelectClient({ name });
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar Cliente</DialogTitle>
          <DialogDescription>
            Escribe al menos 2 caracteres para buscar rápido.
          </DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por código, nombre o email..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <ScrollArea className="h-72">
            <CommandList>
              {isSearching && (
                <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando clientes...
                </div>
              )}
              <CommandEmpty>
                <div className="p-4 text-center text-sm">
                    {searchTerm.trim().length < 2 ? (
                      <p>Escribe 2 o más caracteres para comenzar.</p>
                    ) : (
                      <p>No se encontró el cliente.</p>
                    )}
                    <Button variant="link" onClick={handleCreateNew} disabled={!searchTerm.trim()}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear nuevo cliente llamado "{searchTerm.trim()}"
                    </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {results.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.code || ''} ${client.name || ''} ${client.email || ''}`}
                    onSelect={() => onSelectClient(client)}
                  >
                    <div>
                        <p className="font-medium">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.email}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </ScrollArea>
        </Command>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
