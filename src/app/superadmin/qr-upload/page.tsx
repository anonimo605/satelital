
"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const QR_CONFIG_DOC_ID = 'qrCode';
const DEFAULT_QR_URL = "https://placehold.co/300x300.png";

const QrUploadPage = () => {
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [newQrDataUrl, setNewQrDataUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchQrUrl = async () => {
            setIsLoading(true);
            try {
                const docRef = doc(db, 'config', QR_CONFIG_DOC_ID);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().url) {
                    setQrUrl(docSnap.data().url);
                } else {
                    setQrUrl(DEFAULT_QR_URL);
                }
            } catch (error) {
                console.error("Error fetching QR code:", error);
                setQrUrl(DEFAULT_QR_URL);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQrUrl();
    }, []);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({
                variant: "destructive",
                title: "Archivo inválido",
                description: "Por favor, selecciona un archivo de imagen.",
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setNewQrDataUrl(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!newQrDataUrl) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, 'config', QR_CONFIG_DOC_ID);
            await setDoc(docRef, { url: newQrDataUrl });
            setQrUrl(newQrDataUrl);
            setNewQrDataUrl(null); // Clear the pending change
            toast({ title: "Imagen Guardada", description: "El nuevo código QR ha sido guardado en Firestore." });
        } catch (error) {
            console.error("Error saving QR code:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el nuevo código QR." });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
            <div className="w-full max-w-2xl space-y-8">
                <div className="flex justify-between items-center">
                    <CardTitle>Actualizar Código QR</CardTitle>
                    <Button variant="outline" onClick={() => router.push('/superadmin')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Cambiar Imagen del QR</CardTitle>
                        <CardDescription>Sube una nueva imagen del código QR para los pagos de Nequi. El cambio se guardará en la base de datos y será visible para todos los usuarios.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="qr-upload">Subir nueva imagen QR</Label>
                            <Input id="qr-upload" type="file" accept="image/*" onChange={handleFileChange} disabled={isSaving} />
                        </div>
                        
                        {newQrDataUrl && (
                            <Card className="border-primary">
                                <CardHeader>
                                    <CardTitle>Vista Previa del Nuevo QR</CardTitle>
                                    <CardDescription>Esta es la imagen que se guardará. Haz clic en "Guardar Nuevo QR" para confirmar.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col items-center gap-4">
                                    <Image
                                        src={newQrDataUrl}
                                        width={300}
                                        height={300}
                                        alt="Vista previa del nuevo código QR"
                                        className="rounded-lg"
                                        data-ai-hint="qr code"
                                    />
                                    <Button onClick={handleSave} disabled={isSaving}>
                                        {isSaving ? "Guardando..." : "Guardar Nuevo QR"}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        <div className="space-y-2">
                            <h4 className="font-medium">QR Actual en el Sistema</h4>
                            <div className="border rounded-lg p-4 flex justify-center bg-muted/50">
                                {isLoading ? (
                                    <Skeleton className="h-[300px] w-[300px]" />
                                ) : (
                                    <Image
                                        src={qrUrl || DEFAULT_QR_URL}
                                        width={300}
                                        height={300}
                                        alt="Vista previa del código QR actual"
                                        className="rounded-lg"
                                        data-ai-hint="qr code"
                                        key={qrUrl}
                                    />
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}

export default QrUploadPage;
