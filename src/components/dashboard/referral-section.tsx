
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { User, Transaction } from "@/lib/types";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, documentId, onSnapshot, orderBy } from "firebase/firestore";

type ReferredUser = {
    id: string;
    displayId: string;
    phoneNumber: string;
    balance: number;
};

const ReferralSection = () => {
    const { user } = useAuth();
    const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
    const [referralEarnings, setReferralEarnings] = useState(0);
    const [referralLink, setReferralLink] = useState('');
    const { toast } = useToast();
    
    useEffect(() => {
        if (user?.ownReferralCode) {
            const baseUrl = 'https://satelital.vercel.app';
            setReferralLink(`${baseUrl}/?ref=${user.ownReferralCode}`);
        }
    }, [user?.ownReferralCode]);


    useEffect(() => {
        const fetchReferredUsers = async () => {
            if (user && user.referredUsers && user.referredUsers.length > 0) {
                const usersRef = collection(db, "users");
                // Firestore 'in' query can take up to 30 elements at a time.
                // For a real-world app with many referrals, this would need pagination.
                const q = query(usersRef, where(documentId(), "in", user.referredUsers.slice(0, 30)));
                const querySnapshot = await getDocs(q);
                
                const referrals = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return { id: doc.id, displayId: data.displayId, phoneNumber: data.phoneNumber, balance: data.balance } as ReferredUser;
                });
                
                setReferredUsers(referrals);
            }
        };

        fetchReferredUsers();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        
        // A more correct query to sum up all commission transactions for the current user
        const commissionQuery = query(
            collection(db, "transactions"),
            where("userId", "==", user.id),
            where("type", "==", "credit")
        );
        const commissionUnsubscribe = onSnapshot(commissionQuery, (snapshot) => {
             const totalEarnings = snapshot.docs
                .filter(doc => doc.data().description?.startsWith('Comisión por referido'))
                .reduce((sum, doc) => sum + doc.data().amount, 0);
            setReferralEarnings(totalEarnings);
        });


        return () => {
          commissionUnsubscribe();
        }
    }, [user]);


    const handleCopy = () => {
        if (!referralLink) return;
        navigator.clipboard.writeText(referralLink);
        toast({ title: "¡Copiado!", description: "Tu enlace de referido ha sido copiado." });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Programa de Referidos</CardTitle>
                <CardDescription>Invita a tus amigos compartiendo tu enlace único y visualiza tus referidos aquí.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <p className="text-sm font-medium mb-2">Tu enlace de referido:</p>
                    <div className="flex w-full items-center space-x-2">
                        <Input value={referralLink} readOnly placeholder="Generando enlace..." />
                        <Button variant="secondary" size="icon" onClick={handleCopy} disabled={!referralLink}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-2">Mis Referidos ({referredUsers.length})</h3>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID de Usuario</TableHead>
                                    <TableHead>Número de Celular</TableHead>
                                    <TableHead className="text-right">Saldo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {referredUsers.length > 0 ? (
                                    referredUsers.map((ref) => (
                                        <TableRow key={ref.id}>
                                            <TableCell className="font-mono">{ref.displayId}</TableCell>
                                            <TableCell>{ref.phoneNumber}</TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(ref.balance)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                            Aún no tienes referidos. ¡Comparte tu código!
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div>
                     <p className="text-sm">Ganancias totales por referidos: <span className="font-bold text-green-600">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(referralEarnings)}</span></p>
                </div>
            </CardContent>
        </Card>
    );
};
export default ReferralSection;
