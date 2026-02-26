import type { User } from '@/lib/types';

const employeeOrderKeys = ['miguel', 'vivi', 'ines', 'yami', 'noe', 'fede'];

const normalizeEmployeeName = (name: string) =>
    name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

export const getEmployeeOrderIndex = (name: string) => {
    const normalizedName = normalizeEmployeeName(name);
    const index = employeeOrderKeys.findIndex((key) => normalizedName.startsWith(key));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

export const sortEmployeesByAgendaOrder = <T extends Pick<User, 'name'>>(employees: T[]) =>
    [...employees].sort((a, b) => {
        const indexA = getEmployeeOrderIndex(a.name);
        const indexB = getEmployeeOrderIndex(b.name);

        if (indexA !== Number.MAX_SAFE_INTEGER && indexB !== Number.MAX_SAFE_INTEGER) {
            return indexA - indexB;
        }
        if (indexA !== Number.MAX_SAFE_INTEGER) return -1;
        if (indexB !== Number.MAX_SAFE_INTEGER) return 1;

        return a.name.localeCompare(b.name);
    });