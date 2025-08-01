
"use client";

import { useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface PaymentRequest {
  id: string;
  userId: string;
  userPhoneNumber: string;
  amount: number;
  referenceNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  processedAt?: Timestamp;
}


const RechargeRequests = () => {
    const { toast } = useToast();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [pendingRechargeRequests, setPendingRechargeRequests] = useState<PaymentRequest[]>([]);
    const [processedRechargeRequests, setProcessedRechargeRequests] = useState<PaymentRequest[]>([]);

    const fetchAllRequests = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const rechargeCollection = collection(db, 'paymentRequests');
            const pendingRechargeQuery = query(rechargeCollection, where('status', '==', 'pending'));
            const processedRechargeQuery = query(rechargeCollection, where('status', 'in', ['approved', 'rejected']));
            
            const [pendingSnapshot, processedSnapshot] = await Promise.all([
                getDocs(pendingRechargeQuery),
                getDocs(processedRechargeQuery)
            ]);

            const pendingRecharges = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRequest));
            pendingRecharges.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setPendingRechargeRequests(pendingRecharges);

            const processedRecharges = processedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRequest));
            processedRecharges.sort((a, b) => (b.processedAt?.toMillis() || 0) - (a.processedAt?.toMillis() || 0));
            setProcessedRechargeRequests(processedRecharges);

        } catch (error) {
            console.error("Error fetching requests:", error);
            toast({ title: "Error", description: "No se pudieron cargar las solicitudes. Es posible que falten índices en Firestore.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if(user) {
            fetchAllRequests();
        }
    }, [user, fetchAllRequests]);


    const handleRechargeRequest = async (requestId: string, newStatus: 'approved' | 'rejected') => {
        const request = pendingRechargeRequests.find(r => r.id === requestId);
        if (!request) return;

        try {
            const batch = writeBatch(db);
            const requestRef = doc(db, 'paymentRequests', requestId);
            batch.update(requestRef, { status: newStatus, processedAt: Timestamp.now() });

            if (newStatus === 'approved') {
                const userRef = doc(db, 'users', request.userId);
                const userDoc = await getDoc(userRef);
                if(userDoc.exists()) {
                    const currentBalance = userDoc.data().balance || 0;
                    batch.update(userRef, { balance: currentBalance + request.amount });
                }
            }

            await batch.commit();
            fetchAllRequests(); 

            toast({
                title: `Solicitud ${newStatus === 'approved' ? 'Aprobada' : 'Rechazada'}`,
                description: `La solicitud de recarga de ${request.userPhoneNumber} ha sido procesada.`,
            });

        } catch (error) {
            console.error("Error processing recharge request:", error);
            toast({ title: "Error", description: "No se pudo procesar la solicitud de recarga.", variant: "destructive" });
        }
    };

    if (loading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Solicitudes de Recarga Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Cargando solicitudes...</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Solicitudes de Recarga Pendientes</CardTitle>
                    <CardDescription>Estas solicitudes necesitan ser revisadas para acreditar el saldo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Monto (COP)</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {pendingRechargeRequests.length > 0 ? (
                            pendingRechargeRequests.map(req => (
                                <TableRow key={req.id}>
                                <TableCell>{req.createdAt.toDate().toLocaleString()}</TableCell>
                                <TableCell>{req.userPhoneNumber}</TableCell>
                                <TableCell>${req.amount.toLocaleString('es-CO')}</TableCell>
                                <TableCell>{req.referenceNumber}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button size="sm" onClick={() => handleRechargeRequest(req.id, 'approved')}>Aprobar</Button>
                                    <Button size="sm" variant="destructive" onClick={() => handleRechargeRequest(req.id, 'rejected')}>Rechazar</Button>
                                </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">No hay solicitudes de recarga pendientes.</TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Solicitudes de Recarga</CardTitle>
                    <CardDescription>Aquí se muestran las últimas recargas aprobadas y rechazadas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Fecha Procesada</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Monto (COP)</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Referencia</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {processedRechargeRequests.length > 0 ? (
                            processedRechargeRequests.map(req => (
                                <TableRow key={req.id}>
                                <TableCell>{req.processedAt ? req.processedAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                                <TableCell>{req.userPhoneNumber}</TableCell>
                                <TableCell>${req.amount.toLocaleString('es-CO')}</TableCell>
                                <TableCell>
                                    <Badge variant={req.status === 'approved' ? 'default' : 'destructive'} className={req.status === 'approved' ? 'bg-green-600' : ''}>
                                        {req.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                                    </Badge>
                                </TableCell>
                                <TableCell>{req.referenceNumber}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">No hay solicitudes de recarga procesadas.</TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </>
    )

}

export default RechargeRequests;
