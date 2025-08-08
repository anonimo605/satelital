
"use client";

import { useState, useEffect } from "react";
import type { Satellite, PurchasedSatellite, Transaction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ShoppingCart, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, Timestamp, addDoc, runTransaction, writeBatch, orderBy, query } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Countdown Timer Component
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const calculateTimeLeft = () => {
        const difference = +targetDate - +new Date();
        let timeLeft: { days?: number; hours?: number; minutes?: number; seconds?: number } = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearTimeout(timer);
    });

    const timerComponents: string[] = [];
    if (timeLeft.days !== undefined && timeLeft.days > 0) timerComponents.push(`${timeLeft.days}d`);
    if (timeLeft.hours !== undefined) timerComponents.push(String(timeLeft.hours).padStart(2, '0'));
    if (timeLeft.minutes !== undefined) timerComponents.push(String(timeLeft.minutes).padStart(2, '0'));
    if (timeLeft.seconds !== undefined) timerComponents.push(String(timeLeft.seconds).padStart(2, '0'));

    const timeString = timerComponents.length > 3 
        ? `${timerComponents[0]} ${timerComponents.slice(1,3).join(":")}`
        : timerComponents.join(":");

    if (timeString) {
        return <span className="font-mono text-xs text-primary">{timeString}</span>;
    } else {
        return <span className="text-xs text-primary animate-pulse">Oferta terminada</span>;
    }
};

const SatellitesSection = () => {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const { user, purchasedSatellites } = useAuth();
  const { toast } = useToast();
  const [selectedSatellite, setSelectedSatellite] = useState<Satellite | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "satellites"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const satellitesData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timeLimitSetAt: data.timeLimitSetAt instanceof Timestamp ? data.timeLimitSetAt.toDate() : undefined,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            } as Satellite
        });
        
        const sortedSatellites = satellitesData.sort((a, b) => {
            const aIsLimited = a.isTimeLimited && a.timeLimitSetAt && a.timeLimitHours && (new Date() < new Date(a.timeLimitSetAt.getTime() + a.timeLimitHours * 60 * 60 * 1000));
            const bIsLimited = b.isTimeLimited && b.timeLimitSetAt && b.timeLimitHours && (new Date() < new Date(b.timeLimitSetAt.getTime() + b.timeLimitHours * 60 * 60 * 1000));

            if (aIsLimited && !bIsLimited) return -1;
            if (!aIsLimited && bIsLimited) return 1;

            return a.price - b.price;
        });
        
        setSatellites(sortedSatellites);
    });
    return () => unsubscribe();
  }, []);

  const openConfirmationDialog = (satellite: Satellite) => {
      setSelectedSatellite(satellite);
      setQuantity(1);
      setIsDialogOpen(true);
  };

  const handlePurchase = async () => {
    if (!user || !selectedSatellite) {
      toast({ variant: "destructive", title: "Error", description: "Debes iniciar sesión para comprar." });
      return;
    }

    const numQuantity = Number(quantity);

    if (isNaN(numQuantity) || numQuantity <= 0) {
        toast({ variant: "destructive", title: "Cantidad inválida", description: "La cantidad debe ser un número mayor que cero." });
        return;
    }

    const totalCost = selectedSatellite.price * numQuantity;

    if (user.balance < totalCost) {
      toast({ variant: "destructive", title: "Saldo insuficiente", description: "No tienes suficiente saldo para comprar esta cantidad." });
      return;
    }
    
    const userOwnedCount = purchasedSatellites.filter(p => p.satelliteId === selectedSatellite.id).length;
    if ((userOwnedCount + numQuantity) > selectedSatellite.purchaseLimit) {
        toast({ variant: "destructive", title: "Límite alcanzado", description: `No puedes comprar esta cantidad. El límite para este satélite es ${selectedSatellite.purchaseLimit} y ya posees ${userOwnedCount}.` });
        return;
    }
    
    try {
        const userDocRef = doc(db, "users", user.id);
        const productsColRef = collection(db, `users/${user.id}/purchasedSatellites`);
        const transactionsColRef = collection(db, 'transactions');

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("Usuario no encontrado.");
            }

            const currentBalance = userDoc.data().balance;
            const updatedBalance = currentBalance - totalCost;

            if (updatedBalance < 0) {
                throw new Error("Saldo insuficiente.");
            }

            transaction.update(userDocRef, { 
                balance: updatedBalance,
                version: (user.version || 0) + 1 
            });

            const newTransactionData = {
                userId: user.id,
                type: 'debit',
                amount: totalCost,
                description: `Compra: ${selectedSatellite.name} (x${numQuantity})`,
                date: Timestamp.now(),
            };
            const newTransRef = doc(transactionsColRef);
            transaction.set(newTransRef, newTransactionData);

            for (let i = 0; i < numQuantity; i++) {
                 const purchaseTime = new Date();
                 const newPurchasedSatelliteData: Omit<PurchasedSatellite, 'id'> = {
                    satelliteId: selectedSatellite.id,
                    name: selectedSatellite.name,
                    purchaseDate: purchaseTime,
                    dailyYield: selectedSatellite.dailyYield,
                    status: 'Activo',
                    price: selectedSatellite.price,
                    durationDays: selectedSatellite.durationDays,
                    imageUrl: selectedSatellite.imageUrl,
                };
                const newProductDocRef = doc(productsColRef);
                transaction.set(newProductDocRef, {
                    ...newPurchasedSatelliteData,
                    purchaseDate: Timestamp.fromDate(purchaseTime)
                });
            }
        });

        toast({ title: "¡Compra exitosa!", description: `Has comprado ${numQuantity}x ${selectedSatellite.name}.` });
        setIsDialogOpen(false);
    } catch (error: any) {
        console.error("Purchase failed:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo completar la compra." });
    }
  };

  const isQuantityValid = Number(quantity) > 0 && String(quantity).trim() !== '';

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Comprar Satélites</CardTitle>
        <CardDescription>
          Usa tu saldo para comprar satélites y obtener rendimientos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {satellites.length > 0 ? satellites.map((satellite) => {
            const isLimited = satellite.isTimeLimited && satellite.timeLimitHours && satellite.timeLimitSetAt;
            const expirationDate = isLimited ? new Date(satellite.timeLimitSetAt!.getTime() + satellite.timeLimitHours! * 60 * 60 * 1000) : null;
            const isExpired = expirationDate ? new Date() > expirationDate : false;
            
            if (isLimited && isExpired) return null;
            
            const dailyYieldAmount = satellite.price * (satellite.dailyYield / 100);
            const totalProfit = dailyYieldAmount * satellite.durationDays;

            return (
              <Card key={satellite.id} className="flex flex-col">
                <div className="relative w-full h-48">
                  <Image
                    src={satellite.imageUrl}
                    alt={satellite.name}
                    fill
                    className="rounded-t-lg object-cover"
                    data-ai-hint="investment package"
                  />
                   {isLimited && expirationDate && (
                       <Badge variant="destructive" className="absolute top-2 right-2">
                            <Clock className="mr-1 h-3 w-3" />
                           <CountdownTimer targetDate={expirationDate} />
                       </Badge>
                   )}
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{satellite.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat("es-CO", {
                      style: "currency",
                      currency: "COP",
                      maximumFractionDigits: 0,
                    }).format(satellite.price)}
                  </p>
                   <div className="space-y-1 text-sm">
                        <p className="text-green-600 font-semibold">
                            Rendimiento Diario: +{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(dailyYieldAmount)} ({satellite.dailyYield}%)
                        </p>
                        <p className="text-blue-600 font-semibold">
                            Ganancia Total: +{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(totalProfit)}
                        </p>
                        <p className="text-muted-foreground">
                            Duración: {satellite.durationDays} días
                        </p>
                  </div>
                   <div className="flex justify-between items-baseline text-xs pt-1">
                     <p className="text-muted-foreground">
                        Límite de compra: {satellite.purchaseLimit}
                    </p>
                  </div>
                </CardContent>
                <div className="p-4 pt-0">
                   <Button className="w-full" onClick={() => openConfirmationDialog(satellite)} disabled={!user}>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Comprar
                  </Button>
                </div>
              </Card>
            )
        }) : (
            <div className="text-center text-muted-foreground py-8 col-span-full">
                <p>No hay satélites disponibles para la compra en este momento.</p>
                <p className="text-sm">Por favor, pídele a un administrador que añada satélites nuevos.</p>
            </div>
        )}
      </CardContent>
    </Card>

    {selectedSatellite && (
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Compra</AlertDialogTitle>
                    <AlertDialogDescription>
                        Estás a punto de comprar <strong>{selectedSatellite.name}</strong>.
                        Por favor, selecciona la cantidad y confirma la operación.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Cantidad</Label>
                        <Input 
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            onBlur={(e) => {
                                const numValue = Number(e.target.value);
                                if (isNaN(numValue) || numValue < 1) {
                                    setQuantity(1);
                                }
                            }}
                            className="w-full"
                        />
                    </div>
                     <div className="p-3 border rounded-lg bg-muted/50 text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Precio Unitario:</span>
                            <span className="font-medium">
                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selectedSatellite.price)}
                            </span>
                        </div>
                        <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                            <span>Costo Total:</span>
                            <span className="text-primary">
                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selectedSatellite.price * (Number(quantity) || 0))}
                            </span>
                        </div>
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePurchase} disabled={!isQuantityValid}>Confirmar Compra</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )}
    </>
  );
};

export default SatellitesSection;
