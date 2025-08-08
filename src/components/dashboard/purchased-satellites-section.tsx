
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";

// Countdown Timer Component
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const calculateTimeLeft = () => {
        const difference = +targetDate - +new Date();
        let timeLeft: { hours?: number; minutes?: number; seconds?: number } = {};

        if (difference > 0) {
            timeLeft = {
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

    Object.keys(timeLeft).forEach((interval) => {
        const value = timeLeft[interval as keyof typeof timeLeft];
        timerComponents.push(String(value).padStart(2, '0'));
    });

    if (timerComponents.length) {
        return <span className="font-mono text-lg">{timerComponents.join(":")}</span>;
    } else {
        return <span className="text-primary animate-pulse text-lg">Procesando...</span>;
    }
};


const PurchasedSatellitesSection = () => {
    const { user, purchasedSatellites } = useAuth();

    if (!user) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Mis Satélites</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-8">
                    Cargando información del usuario...
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mis Satélites</CardTitle>
                <CardDescription>
                    Aquí puedes ver todos los satélites que has comprado y su progreso.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {purchasedSatellites.length > 0 ? (
                        purchasedSatellites.map((satellite) => {
                            const purchaseDate = new Date(satellite.purchaseDate);
                            const expirationDate = new Date(new Date(purchaseDate).setDate(purchaseDate.getDate() + satellite.durationDays));
                            const lastDate = satellite.lastYieldDate ? new Date(satellite.lastYieldDate) : new Date(satellite.purchaseDate);
                            const nextYieldDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
                            
                            const daysPassed = (new Date().getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24);
                            const progressPercentage = Math.min((daysPassed / satellite.durationDays) * 100, 100);

                            const dailyYieldAmount = satellite.price * (satellite.dailyYield / 100);
                            const totalProfit = dailyYieldAmount * satellite.durationDays;


                            return (
                                <Card key={satellite.id} className="flex flex-col overflow-hidden shadow-md">
                                    <div className="relative w-full h-40">
                                        <Image 
                                            src={satellite.imageUrl} 
                                            alt={satellite.name}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        />
                                        <Badge variant={satellite.status === 'Activo' ? "default" : "secondary"} className="absolute top-2 right-2">
                                            {satellite.status}
                                        </Badge>
                                    </div>
                                    <CardHeader className="p-4">
                                        <CardTitle className="text-xl">{satellite.name}</CardTitle>
                                        <CardDescription>
                                            Comprado: {purchaseDate.toLocaleDateString("es-CO")}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0 flex-grow flex flex-col justify-between space-y-4">
                                        <div>
                                            <div className="text-sm text-green-600 font-semibold mb-1">
                                                Rendimiento Diario: +{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(dailyYieldAmount)} ({satellite.dailyYield}%)
                                            </div>
                                             <div className="text-sm text-blue-600 font-semibold mb-2">
                                                Ganancia Total: +{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(totalProfit)}
                                            </div>
                                            <div className="text-center bg-muted/50 p-3 rounded-lg">
                                                <p className="text-xs text-muted-foreground">Próximo rendimiento en:</p>
                                                {satellite.status === 'Activo' ? (
                                                    <CountdownTimer targetDate={nextYieldDate} />
                                                ) : (
                                                    <span className="text-muted-foreground text-lg">--:--:--</span>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                <span>Progreso</span>
                                                <span>Expira: {expirationDate.toLocaleDateString("es-CO")}</span>
                                            </div>
                                            <Progress value={progressPercentage} className="h-2" />
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    ) : (
                        <div className="col-span-full text-center text-muted-foreground py-16">
                            <h3 className="text-lg font-semibold">No tienes satélites</h3>
                            <p>Ve a la sección "Comprar" para adquirir tu primer satélite.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default PurchasedSatellitesSection;
