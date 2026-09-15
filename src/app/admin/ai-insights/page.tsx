'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { askBusinessQuestion } from '@/lib/ai-insights';

const EXAMPLE_QUESTIONS = [
  '¿Cuál fue el servicio más rentable en los últimos 60 días?',
  '¿Qué día de la semana tiene menos turnos en general?',
  '¿Cuántos turnos se cancelaron en los últimos 60 días?',
];

export default function AiInsightsPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (q?: string) => {
    const finalQuestion = (q ?? question).trim();
    if (!finalQuestion) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    const result = await askBusinessQuestion(finalQuestion);

    if ('error' in result) {
      setError(result.error);
    } else {
      setAnswer(result.answer);
    }
    setLoading(false);
  };

  return (
    <div className="salon-shell space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-headline font-bold text-primary flex items-center gap-2">
          <Sparkles className="h-6 w-6" />
          Asistente IA (prueba)
        </h1>
        <p className="text-sm text-muted-foreground">
          Preguntá en lenguaje natural sobre turnos, empleados y servicios de los últimos 60 días.
          Esto es una prueba piloto — solo vos podés verla y usarla.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hacé una pregunta</CardTitle>
          <CardDescription>Ejemplos: {EXAMPLE_QUESTIONS[0]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Escribí tu pregunta acá..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <Button
                key={q}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setQuestion(q); handleAsk(q); }}
                disabled={loading}
              >
                {q}
              </Button>
            ))}
          </div>
          <Button onClick={() => handleAsk()} disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Preguntar
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No se pudo responder</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {answer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Respuesta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{answer}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
