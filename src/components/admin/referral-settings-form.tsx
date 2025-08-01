
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, Percent } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';


const DEFAULT_PERCENTAGE = 10;

const formSchema = z.object({
    percentage: z.coerce.number().min(0, "El porcentaje no puede ser negativo.").max(100, "El porcentaje no puede ser mayor a 100."),
});

const ReferralSettingsForm = () => {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            percentage: DEFAULT_PERCENTAGE,
        },
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const configDocRef = doc(db, 'config', 'referrals');
            const docSnap = await getDoc(configDocRef);
            if (docSnap.exists() && docSnap.data().commissionPercentage) {
                form.setValue('percentage', docSnap.data().commissionPercentage);
            }
        };
        fetchSettings();
    }, [form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const configDocRef = doc(db, 'config', 'referrals');
            await setDoc(configDocRef, { commissionPercentage: values.percentage }, { merge: true });
            toast({
                title: "Porcentaje Guardado",
                description: `La comisión por referido se ha establecido en ${values.percentage}%.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al Guardar",
                description: "No se pudo guardar la configuración.",
            });
            console.error("Error saving referral settings:", error);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configurar Porcentaje de Comisión</CardTitle>
                <CardDescription>
                    Define el porcentaje de la primera recarga de un referido que se pagará como comisión a quien lo invitó.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="percentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Porcentaje de Comisión</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                             <Input type="number" step="0.1" placeholder="10" {...field} className="pl-8" />
                                             <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            <Save className="mr-2 h-4 w-4" />
                            Guardar Porcentaje
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export default ReferralSettingsForm;
