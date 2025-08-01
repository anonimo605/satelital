
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User, Transaction, PurchasedSatellite } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Edit, Trash2, Archive, Copy, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, Timestamp, getDocs, addDoc, getDoc, query, where, runTransaction } from 'firebase/firestore';
import { createTransaction } from '@/services/transactionService';

const editBalanceSchema = z.object({
    amount: z.coerce.number().positive("El monto debe ser un número positivo."),
    description: z.string().min(3, "La descripción es requerida."),
    actionType: z.enum(["add", "subtract", "set"], {
        required_error: "Debes seleccionar una acción.",
    }),
});

type UserWithSatellites = User & { purchasedSatellites: PurchasedSatellite[] };

const UserManagement = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [viewingUser, setViewingUser] = useState<UserWithSatellites | null>(null);
    const [viewingReferralsOfUser, setViewingReferralsOfUser] = useState<{user: User, referrals: User[]} | null>(null);

    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as User));
            setUsers(usersData);
        });
        return () => unsubscribe();
    }, []);

    const form = useForm<z.infer<typeof editBalanceSchema>>({
        resolver: zodResolver(editBalanceSchema),
    });

    const handleEditBalance = (user: User) => {
        setSelectedUser(user);
        form.reset({
            amount: 0,
            description: "",
            actionType: "add",
        });
    };

    const handleViewSatellites = async (user: User) => {
        try {
            const satellitesColRef = collection(db, `users/${user.id}/purchasedSatellites`);
            const snapshot = await getDocs(satellitesColRef);
            const satellites = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                purchaseDate: (doc.data().purchaseDate as Timestamp).toDate(),
                lastYieldDate: doc.data().lastYieldDate ? (doc.data().lastYieldDate as Timestamp).toDate() : undefined,
            } as PurchasedSatellite));
            setViewingUser({ ...user, purchasedSatellites: satellites });
        } catch (error) {
            console.error("Error fetching user satellites:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los satélites del usuario." });
        }
    };

    const handleViewReferrals = async (user: User) => {
        if (!user.referredUsers || user.referredUsers.length === 0) {
            toast({ title: "Sin referidos", description: "Este usuario no tiene referidos." });
            return;
        }

        try {
            const referralsQuery = query(collection(db, 'users'), where('__name__', 'in', user.referredUsers));
            const snapshot = await getDocs(referralsQuery);
            const referrals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setViewingReferralsOfUser({ user, referrals });

        } catch (error) {
            console.error("Error fetching referrals:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los referidos." });
        }
    };


    const handleCopy = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast({ title: "Copiado", description: "El texto ha sido copiado." });
    };

    const onSubmitBalance = async (values: z.infer<typeof editBalanceSchema>) => {
        if (!selectedUser || !selectedUser.id) {
            toast({ variant: "destructive", title: "Error", description: "Usuario no seleccionado o inválido." });
            return;
        }

        const userDocRef = doc(db, 'users', selectedUser.id);

        try {
            await runTransaction(db, async (transactionRunner) => {
                const userDoc = await transactionRunner.get(userDocRef);
                 if (!userDoc.exists()) {
                    throw new Error("El usuario no existe.");
                }

                let currentBalance = userDoc.data().balance;
                let newBalance = currentBalance;
                let transactionType: 'credit' | 'debit' = 'credit';
                let transactionAmount = values.amount;

                switch (values.actionType) {
                    case 'add':
                        newBalance += values.amount;
                        transactionType = 'credit';
                        break;
                    case 'subtract':
                        newBalance -= values.amount;
                        transactionType = 'debit';
                        break;
                    case 'set':
                        const diff = values.amount - newBalance;
                        transactionType = diff >= 0 ? 'credit' : 'debit';
                        transactionAmount = Math.abs(diff);
                        newBalance = values.amount;
                        break;
                }
                
                transactionRunner.update(userDocRef, {
                    balance: newBalance,
                    version: (userDoc.data().version || 0) + 1
                });
                
                await createTransaction({
                    userId: selectedUser.id,
                    type: transactionType,
                    amount: transactionAmount,
                    description: values.description,
                });
            });

            setSelectedUser(null);
            toast({ title: "Saldo Actualizado" });
        } catch (error) {
            console.error("Error updating balance: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el saldo." });
        }
    };

    const handleDeleteUser = async (userId: string) => {
        try {
            await deleteDoc(doc(db, 'users', userId));
            toast({ title: "Usuario Eliminado" });
        } catch (error) {
            console.error("Error deleting user: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar al usuario." });
        }
    };

    const handleDeleteSatellite = async (userId: string, satelliteId: string) => {
        if (!userId) {
            toast({ variant: "destructive", title: "Error", description: "ID de usuario inválido." });
            return;
        }
        try {
            const satelliteDocRef = doc(db, `users/${userId}/purchasedSatellites`, satelliteId);
            await deleteDoc(satelliteDocRef);

            setViewingUser(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    purchasedSatellites: prev.purchasedSatellites.filter(p => p.id !== satelliteId)
                };
            });

            toast({ title: "Satélite Eliminado del Usuario" });
        } catch (error) {
            console.error("Error deleting user satellite: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el satélite del usuario." });
        }
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Lista de Usuarios</CardTitle>
                    <CardDescription>Visualiza, edita y elimina usuarios registrados en la plataforma.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID Usuario</TableHead>
                                    <TableHead>Cód. Referido</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Saldo</TableHead>
                                    <TableHead>Referidos</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.length > 0 ? (
                                    users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono">{user.displayId}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(user.id)}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono">{user.ownReferralCode}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(user.ownReferralCode || '')}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell>{user.phoneNumber}</TableCell>
                                            <TableCell>{user.role}</TableCell>
                                            <TableCell className="font-semibold">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(user.balance)}</TableCell>
                                            <TableCell>{user.referredUsers?.length ?? 0}</TableCell>
                                            <TableCell className="text-right space-x-0">
                                                <Button variant="ghost" size="icon" onClick={() => handleEditBalance(user)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleViewSatellites(user)}>
                                                    <Archive className="h-4 w-4" />
                                                </Button>
                                                 <Button variant="ghost" size="icon" onClick={() => handleViewReferrals(user)} disabled={!user.referredUsers || user.referredUsers.length === 0}>
                                                    <Users className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" disabled={user.role === 'superadmin'}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Estás realmente seguro?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario y toda su información. La subcolección de satélites deberá ser eliminada manualmente o con una Cloud Function.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">
                                                                Sí, eliminar usuario
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            No hay usuarios registrados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!selectedUser} onOpenChange={(isOpen) => !isOpen && setSelectedUser(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Saldo de Usuario</DialogTitle>
                        <DialogDescription>
                            Modifica el saldo para {selectedUser?.phoneNumber}. La acción creará una transacción.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedUser && (
                        <div className="text-sm">
                            <span className="text-muted-foreground">Saldo actual: </span> 
                            <span className="font-bold">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selectedUser.balance)}</span>
                        </div>
                    )}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmitBalance)} className="space-y-4">
                            <FormField control={form.control} name="actionType" render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Acción a Realizar</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="add" /></FormControl>
                                                <FormLabel className="font-normal">Añadir</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="subtract" /></FormControl>
                                                <FormLabel className="font-normal">Restar</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="set" /></FormControl>
                                                <FormLabel className="font-normal">Establecer</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Monto (COP)</FormLabel>
                                    <FormControl><Input type="number" placeholder="5000" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción / Razón</FormLabel>
                                    <FormControl><Input placeholder="Bono por buen rendimiento" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? 'Aplicando...' : 'Aplicar Cambios'}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewingUser} onOpenChange={(isOpen) => !isOpen && setViewingUser(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Satélites de {viewingUser?.phoneNumber}</DialogTitle>
                        <DialogDescription>
                            Aquí puedes ver y eliminar los satélites que ha comprado este usuario.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Satélite</TableHead>
                                    <TableHead>Fecha Compra</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewingUser?.purchasedSatellites && viewingUser.purchasedSatellites.length > 0 ? (
                                    viewingUser.purchasedSatellites.map((satellite) => (
                                        <TableRow key={satellite.id}>
                                            <TableCell className="font-medium">{satellite.name}</TableCell>
                                            <TableCell>{new Date(satellite.purchaseDate).toLocaleDateString('es-CO')}</TableCell>
                                            <TableCell>
                                                <Badge variant={satellite.status === 'Activo' ? 'default' : 'secondary'}>
                                                    {satellite.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Eliminar satélite del usuario?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción no se puede deshacer y no devolverá el saldo de la compra al usuario.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction 
                                                                onClick={() => {
                                                                    if (viewingUser) {
                                                                        handleDeleteSatellite(viewingUser.id, satellite.id);
                                                                    }
                                                                }} 
                                                                className="bg-destructive hover:bg-destructive/90">
                                                                Sí, eliminar
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                            Este usuario no tiene satélites comprados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

             <Dialog open={!!viewingReferralsOfUser} onOpenChange={(isOpen) => !isOpen && setViewingReferralsOfUser(null)}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Referidos de {viewingReferralsOfUser?.user.phoneNumber}</DialogTitle>
                        <DialogDescription>
                           Lista de usuarios que se registraron con el código de este usuario.
                        </DialogDescription>
                    </DialogHeader>
                     <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID Usuario</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead>Saldo</TableHead>
                                    <TableHead className="text-right">Satélites</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewingReferralsOfUser?.referrals && viewingReferralsOfUser.referrals.length > 0 ? (
                                    viewingReferralsOfUser.referrals.map((referral) => (
                                        <TableRow key={referral.id}>
                                            <TableCell className="font-mono">{referral.displayId}</TableCell>
                                            <TableCell>{referral.phoneNumber}</TableCell>
                                            <TableCell className="font-semibold">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(referral.balance)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleViewSatellites(referral)}>
                                                    <Archive className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                            Este usuario no tiene referidos.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default UserManagement;
