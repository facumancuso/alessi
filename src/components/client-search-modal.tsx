'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Client } from '@/lib/types';
import { PlusCircle } from 'lucide-react';

interface ClientSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onSelectClient: (client: Partial<Client>) => void;
}

export function ClientSearchModal({ isOpen, onClose, clients, onSelectClient }: ClientSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = useMemo(() => {
    if (!searchTerm) {
      return clients.slice(0, 50); // Show a subset initially
    }
    return clients.filter(client =>
      client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  const handleCreateNew = () => {
    onSelectClient({ name: searchTerm });
  };
  
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar Cliente</DialogTitle>
          <DialogDescription>
            Busca un cliente existente o añade uno nuevo.
          </DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput
            placeholder="Buscar por código, nombre o email..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <ScrollArea className="h-72">
            <CommandList>
              <CommandEmpty>
                <div className="p-4 text-center text-sm">
                    <p>No se encontró el cliente.</p>
                    <Button variant="link" onClick={handleCreateNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear nuevo cliente llamado "{searchTerm}"
                    </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {filteredClients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.name}
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
