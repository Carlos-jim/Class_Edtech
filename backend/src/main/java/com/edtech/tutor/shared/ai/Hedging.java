package com.edtech.tutor.shared.ai;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Peticiones "en relevo" (hedged requests) para recortar las esperas largas de los planes gratuitos.
 *
 * <p>Lanza el primer intento; si no ha respondido tras {@code stagger}, lanza el siguiente sin cancelar el anterior, y
 * así sucesivamente. Gana la primera respuesta correcta y el resto se cancela. Si un intento falla, se lanza el siguiente
 * sin esperar. Cada modelo tiene su propia cola: es raro que todos estén lentos a la vez.
 */
public final class Hedging {

    public static final Duration DEFAULT_STAGGER = Duration.ofSeconds(4);
    public static final Duration DEFAULT_DEADLINE = Duration.ofSeconds(25);

    /** Hilos virtuales: esperar a una red lenta no consume hilos de plataforma. Compartido y nunca se cierra. */
    private static final ExecutorService EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

    /** Ningún intento tuvo éxito: todos fallaron o venció el plazo. */
    public static final class HedgeException extends RuntimeException {

        private final List<Throwable> failures;
        private final boolean deadlineExceeded;

        HedgeException(List<Throwable> failures, boolean deadlineExceeded) {
            super(deadlineExceeded ? "Ningún intento respondió dentro del plazo" : "Todos los intentos fallaron",
                    failures.isEmpty() ? null : failures.getLast());
            this.failures = List.copyOf(failures);
            this.deadlineExceeded = deadlineExceeded;
        }

        public List<Throwable> failures() {
            return failures;
        }

        public boolean deadlineExceeded() {
            return deadlineExceeded;
        }
    }

    private Hedging() {
    }

    public static <T> T race(List<Supplier<T>> attempts, Duration stagger, Duration deadline) {
        if (attempts.isEmpty()) {
            throw new IllegalArgumentException("Se necesita al menos un intento");
        }
        var service = new ExecutorCompletionService<T>(EXECUTOR);
        var launched = new ArrayList<Future<T>>();
        var failures = new ArrayList<Throwable>();
        var end = System.nanoTime() + deadline.toNanos();
        launch(service, attempts, launched);
        try {
            while (true) {
                var remaining = end - System.nanoTime();
                if (remaining <= 0) {
                    throw new HedgeException(failures, true);
                }
                var canLaunch = launched.size() < attempts.size();
                var done = service.poll(canLaunch ? Math.min(stagger.toNanos(), remaining) : remaining, TimeUnit.NANOSECONDS);
                if (done == null) {
                    if (canLaunch) {
                        launch(service, attempts, launched); // el actual tarda: se lanza el relevo
                    }
                    continue;
                }
                try {
                    return done.get();
                } catch (ExecutionException ex) {
                    failures.add(ex.getCause());
                    if (failures.size() == attempts.size()) {
                        throw new HedgeException(failures, false);
                    }
                    if (failures.size() == launched.size() && launched.size() < attempts.size()) {
                        launch(service, attempts, launched); // todos los lanzados fallaron: relevo inmediato
                    }
                }
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new HedgeException(failures, false);
        } finally {
            launched.forEach(future -> future.cancel(true)); // corta las peticiones que ya no hacen falta
        }
    }

    private static <T> void launch(ExecutorCompletionService<T> service, List<Supplier<T>> attempts, List<Future<T>> launched) {
        var attempt = attempts.get(launched.size());
        launched.add(service.submit(attempt::get));
    }
}
