
'use client';
import Link from "next/link";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
  SidebarGroup,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/icons";
import { LayoutDashboard, Calendar, Settings, XCircle, LogOut, Users, CalendarCheck, Package, Scissors, User, CheckCircle, Briefcase, TrendingUp, DollarSign, Download, Loader2, DatabaseZap, Trash2, Edit, Upload as UploadIcon } from "lucide-react";
import { usePathname, useRouter } from 'next/navigation';
import { getUserByEmail, getUsers } from "@/lib/data";
import { useEffect, useState } from "react";
import type { User as UserType } from "@/lib/types";
import { UserContext } from "./user-context";

const routePermissions: Record<string, UserType['role'][]> = {
    '/admin': ['Superadmin', 'Gerente', 'Recepcion'],
    '/admin/my-day': ['Peluquero'],
    '/admin/agenda': ['Superadmin', 'Gerente', 'Recepcion', 'Peluquero'],
    '/admin/appointments': ['Superadmin', 'Gerente', 'Recepcion'],
    '/admin/appointments/new': ['Superadmin', 'Gerente', 'Recepcion', 'Peluquero'],
    '/admin/appointments/fast-entry': ['Superadmin', 'Gerente', 'Recepcion'],
    '/admin/billing': ['Superadmin', 'Gerente', 'Recepcion'],
    '/admin/cancellations': ['Superadmin', 'Gerente', 'Recepcion'],
    '/admin/clients': ['Superadmin', 'Gerente', 'Recepcion'],
    '/admin/clients/[email]': ['Superadmin', 'Gerente', 'Recepcion', 'Peluquero'],
    '/admin/services': ['Superadmin', 'Gerente', 'Recepcion', 'Peluquero'],
    '/admin/products': ['Superadmin', 'Gerente', 'Recepcion', 'Peluquero'],
    '/admin/users': ['Superadmin', 'Gerente', 'Recepcion'],
    '/admin/employees': ['Superadmin', 'Gerente', 'Recepcion'],
    '/admin/settings': ['Superadmin'],
    '/admin/backup': ['Superadmin', 'Gerente'],
    '/admin/import': ['Superadmin', 'Gerente'],
    '/admin/seed': [], // Allow all for now
    '/admin/cleanup': ['Superadmin', 'Gerente'],
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [headerTitle, setHeaderTitle] = useState('Admin Panel');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If we are on the seed page, bypass auth checks
    if (pathname === '/admin/seed' || pathname === '/admin/seed-clients' || pathname === '/admin/import') {
        setIsAuthorized(true);
        setLoading(false);
        return;
    }
    
    const userJson = sessionStorage.getItem('currentUser');
    if (userJson) {
        const userProfile = JSON.parse(userJson) as UserType;
        setCurrentUser(userProfile);

        if (userProfile.role === 'Peluquero' && (pathname === '/admin' || pathname === '/admin/')) {
          router.replace('/admin/my-day');
          return;
        }

        setHeaderTitle(userProfile.role === 'Peluquero' ? userProfile.name : 'Admin Panel');
        
        let basePath = pathname;
        if (pathname.startsWith('/admin/clients/') && pathname.split('/').length === 4) {
            basePath = '/admin/clients/[email]';
        }

        const allowedRoles = routePermissions[basePath];

        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userProfile.role)) {
            router.replace(userProfile.role === 'Peluquero' ? '/admin/my-day' : '/login');
        } else {
            setIsAuthorized(true);
        }

    } else {
        getUsers().then(users => {
            // If there are no users, allow access to create the first one
            if(users.length === 0 && pathname.startsWith('/admin/users')) {
                 setIsAuthorized(true);
            } else {
                 router.replace('/login');
            }
        });
    }
    setLoading(false);
  }, [pathname, router]);

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
    router.push('/login');
  };

  // If it's a seed page, render it without the layout
  if (pathname === '/admin/seed' || pathname === '/admin/cleanup' || pathname === '/admin/seed-clients' || pathname === '/admin/appointments/fast-entry' || pathname === '/admin/import') {
      return <main className="p-4 md:p-6">{children}</main>;
  }
  
  const userRole = currentUser?.role;

  const canViewDashboard = userRole === 'Superadmin' || userRole === 'Gerente' || userRole === 'Recepcion';
  const canManageAppointments = userRole === 'Superadmin' || userRole === 'Gerente' || userRole === 'Recepcion';
  const canManageClients = userRole === 'Superadmin' || userRole === 'Gerente' || userRole === 'Recepcion';
  const canManageUsers = userRole === 'Superadmin' || userRole === 'Gerente' || userRole === 'Recepcion';
  const canManageEmployees = userRole === 'Superadmin' || userRole === 'Gerente' || userRole === 'Recepcion';
  const canManageInventory = userRole === 'Superadmin' || userRole === 'Gerente' || userRole === 'Recepcion' || userRole === 'Peluquero';
  const canAccessSettings = userRole === 'Superadmin';
  const canAccessBackup = userRole === 'Superadmin' || userRole === 'Gerente';
  const canViewAgenda = userRole === 'Superadmin' || userRole === 'Gerente' || userRole === 'Recepcion' || userRole === 'Peluquero';
  const isHairdresser = userRole === 'Peluquero';
  
  if (loading || !isAuthorized) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarContent>
            <SidebarHeader>
              <div className="flex items-center gap-2">
                <span className="text-lg font-body font-bold">
                  <span>ALESS</span>
                  <span className="text-primary">I</span>
                </span>
              </div>
            </SidebarHeader>
            <SidebarMenu>
              {canViewDashboard && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin'}>
                  <Link href="/admin">
                    <LayoutDashboard />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}
              {isHairdresser && (
                  <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/admin/my-day'}>
                      <Link href="/admin/my-day">
                      <Briefcase />
                      Mi Día
                      </Link>
                  </SidebarMenuButton>
                  </SidebarMenuItem>
              )}
              {canViewAgenda && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin/agenda'}>
                  <Link href="/admin/agenda">
                    <CalendarCheck />
                    Agenda
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}
              {canManageAppointments && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/admin/appointments'}>
                    <Link href="/admin/appointments">
                      <Calendar />
                      Turnos
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/admin/appointments/fast-entry'}>
                    <Link href="/admin/appointments/fast-entry">
                      <Edit />
                      Carga Rápida
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/admin/billing'}>
                    <Link href="/admin/billing">
                        <DollarSign />
                        Facturación
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/admin/cancellations'}>
                    <Link href="/admin/cancellations">
                        <XCircle />
                        Cancelaciones
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
              )}
              {canManageClients && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/clients')}>
                  <Link href="/admin/clients">
                    <User />
                    Clientes
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}
              <SidebarGroup>
                <span className="text-xs text-muted-foreground px-2">Gestión</span>
                {canManageEmployees && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/admin/employees'}>
                      <Link href="/admin/employees">
                        <TrendingUp />
                        Empleados
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {canManageInventory && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === '/admin/services'}>
                        <Link href="/admin/services">
                          <Scissors />
                          Servicios
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === '/admin/products'}>
                        <Link href="/admin/products">
                          <Package />
                          Productos
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
              </SidebarGroup>
              {canManageUsers && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/admin/users'}>
                      <Link href="/admin/users">
                        <Users />
                        Usuarios
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              {canAccessBackup && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/admin/backup'}>
                      <Link href="/admin/backup">
                        <Download />
                        Backup
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/admin/import'}>
                      <Link href="/admin/import">
                        <UploadIcon />
                        Importar
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
              {canAccessSettings && (
                 <>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === '/admin/settings'}>
                            <Link href="/admin/settings">
                            <Settings />
                            Configuración
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === '/admin/cleanup'}>
                            <Link href="/admin/cleanup">
                            <Trash2 />
                            Limpieza
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === '/admin/seed'}>
                            <Link href="/admin/seed">
                            <DatabaseZap />
                            Inicializar DB
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                 </>
              )}
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout}>
                      <LogOut />
                      Cerrar Sesión
                  </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
              <div className="flex items-center gap-3 border-t p-2 pt-4">
                  <Avatar>
                      <AvatarImage src="https://st3.depositphotos.com/6672868/13701/v/450/depositphotos_137014128-stock-illustration-user-profile-icon.jpg" alt={currentUser?.name} data-ai-hint="person portrait" />
                      <AvatarFallback>{currentUser?.name.charAt(0) ?? 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                      <span className="font-semibold text-sm">{currentUser?.name ?? 'Usuario'}</span>
                      <span className="text-xs text-muted-foreground">{currentUser?.email ?? 'email@example.com'}</span>
                  </div>
              </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex items-center justify-between p-4 border-b h-16 bg-card/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="text-xl md:text-2xl font.headline font-bold">{headerTitle}</h1>
            </div>
          </header>
          <main className="p-4 md:p-6 bg-secondary/50 flex-1">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </UserContext.Provider>
  );
}
